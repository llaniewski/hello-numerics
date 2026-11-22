-- Live figures: an interactive figure, the R snippet that computes it, and
-- equations filled with values from R.
--
-- Authoring:
--
--   ::: {.live-figure figure="spring1"}
--   ```r
--   x1 <- 3
--   k  <- 2
--   L0 <- 2
--   F  <- -k * (x1 - L0)
--   ```
--
--   $$ F = -{{k}}\,({{x1}} - {{L0}}) = {{F|3}} $$
--   :::
--
-- - `figure`: a module in lib/js/figures/ (inputs, outputs and colors come
--   from it; the attributes `inputs`, `outputs`, `colors="x1:pen1 F:pen3"`
--   override them). `packages="Matrix"` installs webR packages first.
-- - The first `r` code block is the snippet. It is shown and run as is, with
--   only the input literals changing. Write it as ```r (not ```{r}), so knitr
--   doesn't run it on pages with native R chunks.
-- - Display math containing {{expr}} or {{expr|digits}} slots becomes a live
--   equation; until R has run, the slots show "?".
--
-- HTML only. Other formats get the snippet and the equations with "?" slots
-- for now (the PDF build fills them in Phase 4).

local SLOT = "{{.-}}"
local count = 0

local function placeholder(tex)
  return (tex:gsub(SLOT, "?"))
end

-- A paragraph holding one display equation with slots -> its template
local function live_equation(para)
  local math = nil
  for _, el in ipairs(para.content) do
    if el.t == "Math" and el.mathtype == "DisplayMath" and el.text:find(SLOT) then
      if math then return nil end
      math = el
    elseif el.t ~= "Space" and el.t ~= "SoftBreak" and el.t ~= "LineBreak" then
      return nil
    end
  end
  return math
end

function Div(div)
  if not div.classes:includes("live-figure") then return nil end

  if not quarto.doc.is_format("html") then
    return pandoc.walk_block(div, {
      Math = function(m) m.text = placeholder(m.text); return m end,
    }).content
  end

  count = count + 1
  local id = div.identifier ~= "" and div.identifier or ("hn-live-" .. count)
  local figure = div.attributes["figure"]
  if not figure then error("live-figure " .. id .. ": missing figure=\"...\"") end

  local attrs = { ["data-figure"] = figure }
  for _, name in ipairs({ "inputs", "outputs", "colors", "packages" }) do
    if div.attributes[name] then attrs["data-" .. name] = div.attributes[name] end
  end

  local content = pandoc.List({ pandoc.Div({}, pandoc.Attr("", { "hn-live-figure" })) })
  local snippet = false
  for _, block in ipairs(div.content) do
    if block.t == "CodeBlock" and block.classes:includes("r") and not snippet then
      snippet = true
      content:insert(block)
    elseif block.t == "Para" and live_equation(block) then
      local math = live_equation(block)
      content:insert(pandoc.Div(
        { pandoc.Para({ pandoc.Math("DisplayMath", placeholder(math.text)) }) },
        pandoc.Attr("", { "hn-live-eq" }, { ["data-template"] = math.text })))
    else
      content:insert(block)
    end
  end
  if not snippet then error("live-figure " .. id .. ": no ```r code block") end
  content:insert(pandoc.Div({}, pandoc.Attr("", { "hn-live-status" })))

  local mount = (quarto.project.offset or ".") .. "/lib/js/live/mount.js"
  content:insert(pandoc.RawBlock("html", string.format(
    '<script type="module">import { mount } from "%s"; mount("%s");</script>', mount, id)))

  local classes = div.classes:filter(function(c) return c ~= "live-figure" end)
  classes:insert("hn-live")
  return pandoc.Div(content, pandoc.Attr(id, classes, attrs))
end
