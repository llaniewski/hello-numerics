# Formatting R values for LaTeX equations.
#
# Used in two places, so both show identical numbers:
#  - in the browser (webR): fills the {{expr}} slots of live equations;
#  - in native R (PDF build): fills the same templates for the static figures.
#
# A slot expands to the *body* of a matrix or vector, so a template keeps the
# surrounding LaTeX:  \mat{ {{A}} } x = \mat{ {{b}} }
#   matrix -> rows joined by \\ and entries by &, row by row
#   vector -> a column (entries joined by \\)
#   scalar -> a single number

# One number (or other value) as LaTeX, with `digits` significant digits.
tex_number <- function(v, digits = 4) {
  if (length(v) != 1) stop("tex_number: expects a single value")
  if (is.na(v)) return("\\text{NA}")
  if (is.logical(v)) return(if (v) "\\text{TRUE}" else "\\text{FALSE}")
  if (is.complex(v)) {
    re <- tex_number(Re(v), digits)
    im <- tex_number(abs(Im(v)), digits)
    return(paste0(re, if (Im(v) < 0) " - " else " + ", im, "i"))
  }
  if (!is.numeric(v)) return(paste0("\\text{", gsub("([{}_#%&$])", "\\\\\\1", as.character(v)), "}"))
  if (is.infinite(v)) return(if (v > 0) "\\infty" else "-\\infty")
  v <- signif(v, digits)
  if (v == 0) return("0")                       # also turns -0 into 0
  s <- format(v, digits = digits)
  m <- regmatches(s, regexec("^(-?[0-9.]+)e([+-])0*([0-9]+)$", s))[[1]]
  if (length(m) == 0) return(s)
  exponent <- paste0(if (m[3] == "-") "-" else "", m[4])
  if (m[2] == "1") return(paste0("10^{", exponent, "}"))
  if (m[2] == "-1") return(paste0("-10^{", exponent, "}"))
  paste0(m[2], " \\cdot 10^{", exponent, "}")
}

# The entries of `x` formatted as LaTeX: a character matrix with the shape the
# value has in an equation (a vector is a column).
tex_entries <- function(x, digits = 4) {
  if (is.null(digits)) digits <- 4
  if (is.data.frame(x)) x <- as.matrix(x)
  shape <- if (is.matrix(x)) dim(x) else c(length(x), 1L)
  entries <- vapply(as.vector(x), tex_number, "", digits = digits)
  matrix(entries, shape[1], shape[2])
}

# The LaTeX body of `x`: rows joined by \\, entries by &.
tex_body <- function(x, digits = 4) {
  e <- tex_entries(x, digits)
  paste(apply(e, 1, paste, collapse = " & "), collapse = " \\\\ ")
}

# Fill the {{expr}} / {{expr|digits}} slots of a template, evaluating each
# expression in `env`.
tex_fill <- function(template, env = parent.frame()) {
  m <- gregexpr("\\{\\{(.+?)\\}\\}", template, perl = TRUE)
  slots <- regmatches(template, m)[[1]]
  values <- vapply(slots, function(slot) {
    s <- tex_slot(substr(slot, 3, nchar(slot) - 2))
    tex_body(eval(parse(text = s$expr), env), s$digits)
  }, "")
  regmatches(template, m) <- list(values)
  template
}

# Split a slot "expr|digits" into its parts (digits optional).
tex_slot <- function(slot) {
  m <- regmatches(slot, regexec("^(.*?)\\s*\\|\\s*([0-9]+)\\s*$", slot))[[1]]
  if (length(m) == 0) return(list(expr = trimws(slot), digits = NULL))
  list(expr = trimws(m[2]), digits = as.integer(m[3]))
}
