-- Embeds assets/tex/macros.tex into HTML pages, so assets/js/katex-setup.html
-- can pass the shared macros to KaTeX. (The PDF build includes the same file
-- in the LaTeX preamble directly.)
local MACROS = "assets/tex/macros.tex"

function Meta(meta)
  if not quarto.doc.is_format("html") then return nil end
  local path = quarto.project.directory .. "/" .. MACROS
  local f = io.open(path, "r")
  if not f then
    error("macros.lua: cannot read " .. path)
  end
  local tex = f:read("a")
  f:close()
  quarto.doc.include_text("in-header",
    '<script type="text/x-tex" id="hn-katex-macros">\n' .. tex .. '</script>')
  return nil
end
