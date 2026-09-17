// Assigns a category to every book in public/books.json by matching keywords
// against the title, description and tags.
//
// Why this exists: the imported library has all 450 books labelled "Arcade",
// so the category rail had exactly one entry and was dead weight. These rules
// are a heuristic, not truth. The original label is kept as `category_raw` so
// nothing is lost, and re-running is safe because the raw value is what gets
// matched against, never the derived one.
//
//   node scripts/categorize.mjs            report only, writes nothing
//   node scripts/categorize.mjs --write     writes public/books.json
//   node scripts/categorize.mjs --file libraries/goblin.json --write
//       --file takes a path under public/, so the per source libraries can be
//       categorized the same way as the built in list
//
// To correct a book, add a word from its title to the right rule below, or set
// its category by hand in books.json and add the title to KEEP.

import { readFileSync, writeFileSync } from 'node:fs'
// Shared with src/lumin.js, which needs the same rules at runtime.
import { categoryFor } from '../src/categorize.js'

const fileAt = process.argv.indexOf('--file')
const REL = fileAt === -1 ? 'books.json' : process.argv[fileAt + 1]
const FILE = new URL(`../public/${REL}`, import.meta.url)

// Titles whose hand set category must never be overwritten.
const KEEP = new Set([])

const write = process.argv.includes('--write')
const books = JSON.parse(readFileSync(FILE, 'utf8'))
const counts = {}
let changed = 0

for (const book of books) {
  // Preserve the imported label once, and always match against it so the
  // script is idempotent.
  if (book.category_raw === undefined) book.category_raw = book.category ?? null

  const next = KEEP.has(book.title) ? book.category : categoryFor(book)
  if (next !== book.category) changed++
  book.category = next
  counts[next] = (counts[next] || 0) + 1
}

const report = Object.entries(counts).sort((a, b) => b[1] - a[1])
console.log(`${REL}: ${books.length} books, ${changed} recategorized\n`)
for (const [name, n] of report) {
  console.log(`  ${String(n).padStart(4)}  ${name}`)
}

if (write) {
  writeFileSync(FILE, JSON.stringify(books, null, 2) + '\n')
  console.log(`\nwrote public/${REL}`)
} else {
  console.log('\ndry run, pass --write to save')
}
