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
-- PDF (and other non-HTML formats): the scopes are evaluated in native R
-- (lib/R/static.R, with the same nesting as in the browser), equations are
-- filled by tex_fill(), and figures are drawn by their own modules in
-- headless Chromium (scripts/snapshot-figures.mjs) and included as images.
-- Shown code is the code as written; hidden blocks and sliders are left out.
-- `pdf-states="x1=1.5 | x1=3.5"` on a figure scope draws one figure per
-- state, one under the other, captioned with the state (the code and
-- equations show the first state).
-- Needs Rscript (with the renv library) and Node >= 20 with Playwright;
-- set HN_NODE to the node binary if `node` on PATH is too old.

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

local function is_scope(div)
  return div.t == "Div" and (div.classes:includes("live") or div.classes:includes("live-figure"))
end

function Div(div)
  local scope = is_scope(div)
  local is_slider = div.classes:includes("live-slider")
  if not scope and not is_slider then return nil end
  if not quarto.doc.is_format("html") then return nil end   -- handled in Pandoc() below

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

local static_page   -- defined below

function Pandoc(doc)
  if not quarto.doc.is_format("html") then return static_page(doc) end
  if not used then return nil end
  local page = (quarto.project.offset or ".") .. "/lib/js/live/page.js"
  doc.blocks:insert(pandoc.RawBlock("html", string.format(
    '<script type="module">import { mountPage } from "%s"; mountPage();</script>', page)))
  return doc
end

-------------------------------------------------------------------------------
-- Static output (PDF)

local ROOT = quarto.project.directory or pandoc.path.directory(quarto.doc.input_file)

local function r_string(str)
  str = str:gsub("\\", "\\\\"):gsub('"', '\\"'):gsub("\n", "\\n"):gsub("\r", "\\r"):gsub("\t", "\\t")
  return '"' .. str .. '"'
end

local function r_vec(list)
  if #list == 0 then return "character(0)" end
  local parts = {}
  for _, v in ipairs(list) do table.insert(parts, r_string(v)) end
  return "c(" .. table.concat(parts, ", ") .. ")"
end

local function pattern_escape(str)
  return (str:gsub("[%^%$%(%)%%%.%[%]%*%+%-%?]", "%%%0"))
end

-- `name <- 1.5` (or `name = 1.5`): captures (prefix, number)
local function literal_patterns(name)
  local n = "%f[%w_.]" .. pattern_escape(name)
  return { "(" .. n .. "%s*<%-%s*)(%-?[%d%.]+)", "(" .. n .. "%s*=%s*)(%-?[%d%.]+)" }
end

local function find_literal(text, name)
  for _, p in ipairs(literal_patterns(name)) do
    local _, value = text:match(p)
    if value then return tonumber(value) end
  end
  return nil
end

local function set_literal(text, name, value)
  for _, p in ipairs(literal_patterns(name)) do
    if text:match(p) then
      return (text:gsub(p, function(prefix) return prefix .. value end, 1)), true
    end
  end
  return text, false
end

-- Read `export const <key> = [...]` from a figure module
local function module_list(figure, key)
  local f = io.open(ROOT .. "/lib/js/figures/" .. figure .. ".js", "r")
  if not f then error("live-figure: no figure module lib/js/figures/" .. figure .. ".js") end
  local text = f:read("a")
  f:close()
  local inside = text:match("export const " .. key .. "%s*=%s*%[(.-)%]")
  local out = {}
  for name in (inside or ""):gmatch('"([^"]+)"') do table.insert(out, name) end
  return out
end

local function split_list(str)
  local out = {}
  for item in (str or ""):gmatch("[^%s,]+") do table.insert(out, item) end
  return out
end

-- "x1=1.5 | x1=3, k=4" -> { {x1="1.5"}, {x1="3", k="4"} }
local function parse_states(str)
  if not str then return { {} } end
  local states = {}
  for part in (str .. "|"):gmatch("([^|]*)|") do
    local state = {}
    for name, value in part:gmatch("([%w_.]+)%s*=%s*(%-?[%d%.]+)") do state[name] = value end
    table.insert(states, state)
  end
  return states
end

local function camel(name)
  return (name:gsub("%-(%l)", function(c) return c:upper() end))
end

local function run(cmd, args, input)
  return pandoc.system.with_working_directory(ROOT, function()
    return pandoc.pipe(cmd, args, input)
  end)
end

static_page = function(doc)
  -- 1. Scopes in page order; ids as in the HTML (counted from the inside out,
  --    per source file). A book's PDF is one combined document; Quarto marks
  --    where each chapter's file starts with a quarto-file-metadata comment.
  local scopes, post = {}, 0
  local file = pandoc.path.make_relative(quarto.doc.input_file, ROOT)
  local function collect(blocks, parent)
    for _, b in ipairs(blocks) do
      local marker = b.t == "RawBlock" and b.text:match("^<!%-%- quarto%-file%-metadata: ([^ ]+) %-%->$")
      if marker then
        local meta = pandoc.json.decode(quarto.base64.decode(marker), false)
        if meta.bookItemFile then file = meta.bookItemFile; post = 0 end
      elseif is_scope(b) then
        local s = { div = b, parent = parent, codes = {}, hidden = {}, eqs = {}, file = file }
        table.insert(scopes, s)
        collect(b.content, s)
        post = post + 1
        s.id = b.identifier ~= "" and b.identifier or ("hn-live-" .. post)
      elseif b.t == "Div" then
        collect(b.content, parent)
      elseif parent and is_live_code(b) then
        table.insert(parent.codes, b.text)
        table.insert(parent.hidden, b.classes:includes("hidden"))
      elseif parent and b.t == "Para" and live_equation(b) then
        table.insert(parent.eqs, live_equation(b).text)
      end
    end
  end
  collect(doc.blocks, nil)
  if #scopes == 0 then
    return doc:walk({ Div = function(d) if d.classes:includes("live-slider") then return {} end end })
  end

  local function chain(s)
    local out = {}
    while s do table.insert(out, 1, s); s = s.parent end
    return out
  end

  -- 2. What to compute: every scope with a figure or equations, once per state
  local tasks = {}
  for _, s in ipairs(scopes) do
    local figure = s.div.attributes["figure"]
    if figure then
      s.figure = figure
      s.inputs = s.div.attributes["inputs"] and split_list(s.div.attributes["inputs"]) or module_list(figure, "inputs")
      s.outputs = s.div.attributes["outputs"] and split_list(s.div.attributes["outputs"]) or module_list(figure, "outputs")
    end
    if figure or #s.eqs > 0 then
      s.states = parse_states(figure and s.div.attributes["pdf-states"] or nil)
      s.results = {}
      for i, state in ipairs(s.states) do
        -- the code of the scope chain, with this state's values filled in
        local codes, applied = {}, {}
        local scope_chain = chain(s)
        local texts = {}
        for j, c in ipairs(scope_chain) do texts[j] = { table.unpack(c.codes) } end
        for name, value in pairs(state) do
          for j = #scope_chain, 1, -1 do          -- innermost scope that assigns it
            local done = false
            for k, text in ipairs(texts[j]) do
              local new, ok = set_literal(text, name, value)
              if ok then texts[j][k] = new; done = true; break end
            end
            if done then applied[name] = true; break end
          end
          if not applied[name] then error("pdf-states: no literal assignment of " .. name .. " in scope " .. s.id) end
        end
        for j = 1, #scope_chain do table.insert(codes, table.concat(texts[j], "\n")) end
        if i == 1 then s.shown = texts[#texts] end
        -- input values for the figure: from the code as it runs in this state
        local values = {}
        for _, name in ipairs(s.inputs or {}) do
          for j = #scope_chain, 1, -1 do
            for _, text in ipairs(texts[j]) do
              values[name] = values[name] or find_literal(text, name)
            end
          end
        end
        table.insert(tasks, { scope = s, state = i, codes = codes, values = values })
      end
    end
  end

  -- 3. Native R: one call for the whole page
  local calls = {}
  for _, t in ipairs(tasks) do
    table.insert(calls, string.format("  hn_static(%s, %s, %s)",
      r_vec(t.codes), r_vec(t.scope.outputs or {}), r_vec(t.scope.eqs)))
  end
  local script = table.concat({
    "source(" .. r_string(ROOT .. "/lib/R/tex.R") .. ")",
    "source(" .. r_string(ROOT .. "/lib/R/static.R") .. ")",
    "res <- list(\n" .. table.concat(calls, ",\n") .. "\n)",
    "cat(jsonlite::toJSON(res, digits = NA))",
  }, "\n")
  local results = pandoc.json.decode(run("Rscript", { "-" }, script), false)

  -- 4. Figures: one headless browser call for the page
  local figdir = ROOT .. "/_figs"
  pandoc.system.make_directory(figdir, true)
  local items = {}
  for i, t in ipairs(tasks) do
    local s, r = t.scope, results[i]
    if t.state == 1 then s.tex = r.tex end
    if s.figure then
      local state = {}
      for name, value in pairs(t.values) do state[name] = value end
      for j, name in ipairs(s.outputs) do
        local v = r.outputs[j]
        state[name] = (#v == 1) and v[1] or v
      end
      local data = {}
      for name, value in pairs(s.div.attributes) do data[camel(name)] = value end
      local stem = pandoc.path.split_extension(s.file):gsub("[/\\]", "-")
      local name = string.format("%s-%s-%d.png", stem, s.id, t.state)
      local file = "_figs/" .. name      -- relative: LaTeX runs in the project directory
      table.insert(items, { file = figdir .. "/" .. name, figure = s.figure, state = state,
        opts = { inputs = s.inputs, outputs = s.outputs, data = data } })
      s.images = s.images or {}
      local caption = {}
      for name, value in pairs(s.states[t.state]) do table.insert(caption, name .. " = " .. value) end
      table.sort(caption)
      table.insert(s.images, { file = file, caption = table.concat(caption, ", ") })
    end
  end
  if #items > 0 then
    run(os.getenv("HN_NODE") or "node", { ROOT .. "/scripts/snapshot-figures.mjs" },
      pandoc.json.encode({ root = ROOT, items = items }))
  end

  -- 5. Rewrite the page: figures, shown code, filled equations, a link to
  --    the interactive version; no hidden code, no sliders
  local site = doc.meta.book and doc.meta.book["site-url"] and pandoc.utils.stringify(doc.meta.book["site-url"])
  local si = 0
  local function rewrite(blocks, current)
    local out = pandoc.List()
    for _, b in ipairs(blocks) do
      if is_scope(b) then
        si = si + 1
        local s = scopes[si]
        s.code_i, s.eq_i = 0, 0
        if s.images then
          if #s.images == 1 then
            out:insert(pandoc.Para({ pandoc.Image({}, s.images[1].file, "", pandoc.Attr("", {}, { width = "100%" })) }))
          else
            local panels = pandoc.List()
            for _, img in ipairs(s.images) do
              panels:insert(pandoc.Figure(
                { pandoc.Plain({ pandoc.Image({}, img.file, "", pandoc.Attr("", {}, { width = "100%" })) }) },
                { pandoc.Plain(pandoc.Inlines(img.caption)) }))
            end
            out:extend(panels)   -- one under the other, at the same scale
          end
          if site then
            local url = site:gsub("/$", "") .. "/" .. s.file:gsub("%.qmd$", ".html") .. "#" .. s.id
            out:insert(pandoc.Para({ pandoc.Emph({ pandoc.Str("Interactive version:"), pandoc.Space(), pandoc.Link(url, url) }) }))
          end
        end
        out:extend(rewrite(b.content, s))
      elseif b.t == "Div" and b.classes:includes("live-slider") then
        -- nothing to drag on paper: say what the slider does online
        local a = b.attributes
        local range = (a.min and a.max) and (" (from " .. a.min .. " to " .. a.max .. ")") or ""
        out:insert(pandoc.Para({ pandoc.Emph({
          pandoc.Str("In the online version, a slider here changes"), pandoc.Space(),
          pandoc.Code(a.input or "?"), pandoc.Str(range .. "."),
        }) }))
      elseif b.t == "Div" then
        b.content = rewrite(b.content, current)
        out:insert(b)
      elseif current and is_live_code(b) then
        current.code_i = current.code_i + 1
        if not current.hidden[current.code_i] then
          if current.shown then b.text = current.shown[current.code_i] end
          b.classes = b.classes:filter(function(c) return c ~= "hidden" end)
          out:insert(b)
        end
      elseif current and b.t == "Para" and live_equation(b) then
        current.eq_i = current.eq_i + 1
        local tex = current.tex and current.tex[current.eq_i] or placeholder(live_equation(b).text)
        out:insert(pandoc.Para({ pandoc.Math("DisplayMath", tex) }))
      else
        out:insert(b)
      end
    end
    return out
  end
  doc.blocks = rewrite(doc.blocks, nil)
  return doc
end
