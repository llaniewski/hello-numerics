source(file.path(testthat::test_path(), "..", "..", "lib", "R", "tex.R"))

test_that("numbers use significant digits", {
  expect_equal(tex_number(2), "2")
  expect_equal(tex_number(-2.5), "-2.5")
  expect_equal(tex_number(1 / 3), "0.3333")
  expect_equal(tex_number(1 / 3, 2), "0.33")
  expect_equal(tex_number(123456), "123500")
  expect_equal(tex_number(-0), "0")
})

test_that("very small and large numbers use powers of ten", {
  expect_equal(tex_number(1e-5), "10^{-5}")
  expect_equal(tex_number(2.5e-7), "2.5 \\cdot 10^{-7}")
  expect_equal(tex_number(-3e12), "-3 \\cdot 10^{12}")
})

test_that("special values", {
  expect_equal(tex_number(NA), "\\text{NA}")
  expect_equal(tex_number(Inf), "\\infty")
  expect_equal(tex_number(TRUE), "\\text{TRUE}")
  expect_equal(tex_number("a_b"), "\\text{a\\_b}")
})

test_that("bodies: matrices row by row, vectors as columns", {
  A <- matrix(c(10, 1, 2, 10), 2, 2)   # column by column: [10 2; 1 10]
  expect_equal(tex_body(A), "10 & 2 \\\\ 1 & 10")
  expect_equal(tex_body(c(0.12, 0.23)), "0.12 \\\\ 0.23")
  expect_equal(tex_body(3), "3")
  expect_equal(tex_body(matrix(1:3, 1)), "1 & 2 & 3")
})

test_that("templates are filled in the given environment", {
  env <- new.env()
  env$A <- matrix(c(10, 1, 2, 10), 2, 2)
  env$x <- 1 / 3
  expect_equal(
    tex_fill("\\mat{ {{A}} } = {{x|2}} + {{2 * x}}", env),
    "\\mat{ 10 & 2 \\\\ 1 & 10 } = 0.33 + 0.6667")
})

test_that("slot syntax", {
  expect_equal(tex_slot("x"), list(expr = "x", digits = NULL))
  expect_equal(tex_slot(" x | 3 "), list(expr = "x", digits = 3L))
  expect_equal(tex_slot("a || b"), list(expr = "a || b", digits = NULL))
})
