# JSDoc-R

Converts JSDoc comments into R package documentation, as `.Rd` files.

## Running

From your package base, call:

```sh
npm exec jsdoc -- -t path/to/jsdoc-r inst/www/js
```

Where `inst/www/js` is the directory containing the documented JavaScript.