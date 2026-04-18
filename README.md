# JSONed

A graphical JSON editor that runs entirely in the browser: no dependencies, one HTML file.

## Features

- **Visual editing** — JSON structure rendered as nested blocks with `{` `}` and `[` `]` braces
- **Objects and arrays** — press `↓` in any value field to choose between nesting an object or an array
- **Keyboard-first navigation**

  | Key | Action |
  |-----|--------|
  | `Tab` | Move from key → value |
  | `Tab` / `Enter` in value | Add new entry below |
  | `Enter` in key | Add new entry below |
  | `↑` / `↓` in key | Navigate between entries |
  | `↑` in value | Focus parent key (escape nested node) |
  | `↓` in value | Show object / array picker |
  | `Backspace` on empty key | Delete entry |
  | `Ctrl+S` | Save to file |
  | `Ctrl+F` | Open jq-like select bar |
  | `Escape` | Close select bar |

- **Collapse / expand** — click the triangle next to any `{` or `[` to fold a node
- **Live JSON preview** — right-hand panel shows the serialised output in real time
- **Copy to clipboard** — one-click copy from the preview panel
- **Open / Save** — load any `.json` file from disk and save back to a local file
- **jq-like select** — filter the document with path expressions (see below)

## jq-like Select

Open with `Ctrl+F`. Matched entries are highlighted in the editor and the filtered result appears in the preview.

| Expression | Meaning |
|------------|---------|
| `.key` | Select a field by name |
| `.a.b` | Nested field access |
| `.items[]` | Iterate all values under a key |
| `.[]` | Iterate all top-level values |
| `.items[] \| select(.type == "foo")` | Filter with a condition |

Supported operators in `select()`: `==` `!=` `<` `>` `<=` `>=`

## Usage

Open `index.html` directly in any modern browser, or visit the [GitHub Pages deployment](https://julien-paoletti.github.io/jsonEd/).

No installation required.

## Development

The entire application is a single `index.html` file — HTML, CSS, and JS all in one place. Edit it directly and open in a browser to test.

## License

[MIT](LICENSE)

---

Made with ❤️ in Bordeaux
