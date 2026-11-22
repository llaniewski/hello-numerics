# Static (PDF) evaluation of live scopes, in native R. Called by
# filters/live.lua for formats other than HTML; needs tex.R.
#
# codes: the code of a scope and of all scopes around it, outermost first.
#   Each runs in its own environment, whose parent is the previous one's,
#   exactly like in the browser (lib/R/live.R).
# outputs: R expressions the figure needs (numbers).
# templates: equations with {{expr}} slots, filled by tex_fill().
hn_static <- function(codes, outputs = character(0), templates = character(0)) {
  env <- globalenv()
  for (code in codes) {
    env <- new.env(parent = env)
    eval(parse(text = code, keep.source = FALSE), env)
  }
  list(
    outputs = lapply(outputs, function(o) as.numeric(eval(parse(text = o, keep.source = FALSE), env))),
    tex = vapply(templates, tex_fill, "", env = env, USE.NAMES = FALSE)
  )
}
