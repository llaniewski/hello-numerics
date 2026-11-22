# Browser runtime for live scopes (loaded into webR by lib/js/live/webr.js,
# together with tex.R). Not used by the PDF build.
#
# Every live scope has an environment, whose parent is the environment of the
# enclosing scope (or the global environment). A run recreates the
# environments of the scopes it runs, so no values linger from earlier runs;
# the caller always runs a scope together with all scopes inside it, parents
# first.

.hn_envs <- new.env()

# ids, parents, codes: one entry per scope to run, parents before children
#   (parent "" = top level).
# read_*: values to read back afterwards, one entry per value:
#   read_scope: scope id; read_kind: "out" (numbers) or "slot" (LaTeX entries);
#   read_expr: R expression; read_digits: significant digits for slots (NA or -1: default).
# Returns list(errors = one message per scope ("" if fine),
#              reads  = one character vector per read,
#              read_errors = one message per read).
.hn_run <- function(ids, parents, codes, read_scope, read_kind, read_expr, read_digits) {
  errors <- character(length(ids))
  for (i in seq_along(ids)) {
    parent <- if (nzchar(parents[i])) .hn_envs[[parents[i]]] else globalenv()
    env <- new.env(parent = parent)
    assign(ids[i], env, envir = .hn_envs)
    errors[i] <- tryCatch({
      eval(parse(text = codes[i], keep.source = FALSE), env)
      ""
    }, error = function(e) conditionMessage(e))
  }
  read_errors <- character(length(read_scope))
  reads <- lapply(seq_along(read_scope), function(j) {
    env <- .hn_envs[[read_scope[j]]]
    tryCatch({
      value <- eval(parse(text = read_expr[j], keep.source = FALSE), env)
      if (read_kind[j] == "out") {
        format(as.numeric(value), digits = 15, scientific = FALSE, trim = TRUE)
      } else {
        digits <- if (is.na(read_digits[j]) || read_digits[j] < 0) NULL else read_digits[j]
        e <- tex_entries(value, digits)
        c(nrow(e), ncol(e), as.vector(t(e)))
      }
    }, error = function(e) {
      read_errors[j] <<- conditionMessage(e)
      character(0)
    })
  })
  list(errors = errors, reads = reads, read_errors = read_errors)
}

# Packages from the list that are not installed yet (to install from
# repo.r-wasm.org before the first run).
.hn_missing_packages <- function(pkgs) {
  pkgs[!vapply(pkgs, requireNamespace, logical(1), quietly = TRUE)]
}
