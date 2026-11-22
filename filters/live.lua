-- Live scopes: R code that runs in the browser, figures and equations fed by
-- it, and sliders. The runtime is lib/js/live/page.js; see there for the
-- rules of scopes and inputs.
--
-- Authoring:
--
--   :::: {.live}                          a scope (scopes nest)
--   ```{.r .hidden}                       runs, but isn't shown on the page
--   library(Matrix)
--   ```
--   ```r                                  runs in this scope's environment
--   k  <- 2
--   ```
--
--   ::: {.live figure="spring1"}          an inner scope: sees k, adds its own
--   ```r
--   x1 <- 3
--   F  <- -k * (x1 - 2)
--   ```
--   $$ F = {{F|3}} $$                     display math with {{expr}} slots
--   :::
--
--   ::: {.live-slider input="k" min="0.5" max="5" step="0.1" color="pen2"}
--   Spring constant
--   :::
--   ::::
--
-- - `figure`: a module in lib/js/figures/ (its inputs, outputs and colors can
--   be overridden with the attributes `inputs`, `outputs`, `colors="x1:pen1"`;
--   other attributes are passed to the module as settings).
-- - Every ```r / {.r} block in a scope belongs to it and runs, in page order.
--   Write ```r (not ```{r}), so knitr doesn't run it. Add `.static` to a
--   block to keep it out (shown, never run).
-- - Packages are found from library() calls and installed in the browser.
-- - Each shown block gets a "Full code" button (enclosing scopes' code + its own).
--
-- HTML only. Other formats get the shown code and the equations with "?"
-- slots for now (the PDF build fills them in Phase 4).

local SLOT = "{{.-}}"
local count = 0
local used = false

local function placeholder(tex)
  return (tex:gsub(SLOT, "?"))
end

-- A paragraph holding one display equation with slots -> that Math element
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

local function is_live_code(block)
  return block.t == "CodeBlock" and block.classes:includes("r") and not block.classes:includes("static")
end

local function has_class(block, class)
  return block.t == "Div" and block.classes:includes(class)
end

-- Converts the blocks of one scope (not those of inner scopes, which were
-- converted already: Pandoc filters work from the inside out).
local function convert(blocks)
  local out = pandoc.List()
  for _, block in ipairs(blocks) do
    if is_live_code(block) then
      local hidden = block.classes:includes("hidden")
      block.classes = block.classes:filter(function(c) return c ~= "hidden" end)
      local classes = { "hn-live-code" }
      if hidden then table.insert(classes, "hn-live-hidden") end
      out:insert(pandoc.Div({ block }, pandoc.Attr("", classes)))
    elseif block.t == "Para" and live_equation(block) then
      local math = live_equation(block)
      out:insert(pandoc.Div(
        { pandoc.Para({ pandoc.Math("DisplayMath", placeholder(math.text)) }) },
        pandoc.Attr("", { "hn-live-eq" }, { ["data-template"] = math.text })))
    elseif block.t == "Div" and not (has_class(block, "hn-live") or has_class(block, "hn-live-end")
        or has_class(block, "hn-live-code") or has_class(block, "hn-live-eq") or has_class(block, "hn-live-slider")
        or has_class(block, "hn-live-figure") or has_class(block, "hn-live-status")) then
      block.content = convert(block.content)   -- e.g. a callout inside a scope
      out:insert(block)
    else
      out:insert(block)
    end
  end
  return out
end

local function data_attrs(div, names)
  local attrs = {}
  for _, name in ipairs(names) do
    if div.attributes[name] then attrs["data-" .. name] = div.attributes[name] end
  end
  return attrs
end

-- All attributes as data-*: figure, inputs, outputs, colors, and settings
-- for the figure module (passed to it as opts.data)
local function all_data_attrs(div)
  local attrs = {}
  for name, value in pairs(div.attributes) do attrs["data-" .. name] = value end
  return attrs
end

local function without(classes, class)
  return classes:filter(function(c) return c ~= class end)
end

function Div(div)
  local is_scope = div.classes:includes("live") or div.classes:includes("live-figure")
  local is_slider = div.classes:includes("live-slider")
  if not is_scope and not is_slider then return nil end

  if not quarto.doc.is_format("html") then
    if is_slider then return {} end
    local blocks = pandoc.List()
    for _, block in ipairs(div.content) do
      if not (block.t == "CodeBlock" and block.classes:includes("hidden")) then blocks:insert(block) end
    end
    return pandoc.walk_block(pandoc.Div(blocks), {
      Math = function(m) m.text = placeholder(m.text); return m end,
    }).content
  end

  used = true
  if is_slider then
    if not div.attributes["input"] then error("live-slider: missing input=\"...\"") end
    return pandoc.Div(div.content, pandoc.Attr(div.identifier, { "hn-live-slider" },
      data_attrs(div, { "input", "min", "max", "step", "color" })))
  end

  -- A scope becomes a start marker, its content and an end marker, not a
  -- wrapping div: headings inside then stay ordinary sections (Pandoc leaves
  -- headings inside divs out of the table of contents).
  count = count + 1
  local id = div.identifier ~= "" and div.identifier or ("hn-live-" .. count)
  local classes = without(without(div.classes, "live"), "live-figure")
  classes:insert("hn-live")
  local blocks = pandoc.List({ pandoc.Div({}, pandoc.Attr(id, classes,
    all_data_attrs(div))) })
  if div.attributes["figure"] then
    blocks:insert(pandoc.Div({}, pandoc.Attr(id .. "-figure", { "hn-live-figure" })))
  end
  blocks:extend(convert(div.content))
  blocks:insert(pandoc.Div({}, pandoc.Attr("", { "hn-live-status" })))
  blocks:insert(pandoc.Div({}, pandoc.Attr("", { "hn-live-end" })))
  return blocks
end

function Pandoc(doc)
  if not used then return nil end
  local page = (quarto.project.offset or ".") .. "/lib/js/live/page.js"
  doc.blocks:insert(pandoc.RawBlock("html", string.format(
    '<script type="module">import { mountPage } from "%s"; mountPage();</script>', page)))
  return doc
end
