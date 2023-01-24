import { parse } from '../core/ast'
import { makeGuide } from '../core/guide'
import { astToText } from '../core/table'
import { ColorController } from './color'
import { DiagramController } from './diagram'
import { openDialog } from './dialog'
import { InputController } from './input'
import { normalize } from './normalize'

const root = document.body.parentElement as HTMLElement
const editor = document.querySelector('#editor') as HTMLTextAreaElement
const input = editor.querySelector('textarea') as HTMLTextAreaElement
const diagram = document.querySelector('#diagram') as HTMLDivElement

const tableStub = document.querySelector(
  '[data-table="_stub_"]',
) as HTMLDivElement

const inputController = new InputController(input)
const colorController = new ColorController(
  root,
  { editor, input, diagram, tableStub },
  inputController,
)
const diagramController = new DiagramController(
  diagram,
  inputController,
  colorController,
)

input.value = localStorage.getItem('input') || input.value
input.style.width = localStorage.getItem('input_width') || ''

window.addEventListener('storage', () => {
  input.value = localStorage.getItem('input') || input.value
})

input.addEventListener('input', event => {
  localStorage.setItem('input', input.value)
  checkNewTable(event as InputEvent)
})

function checkNewTable(event: InputEvent) {
  if (!(event.inputType == 'insertText' && event.data == '-')) return
  if (input.selectionStart != input.selectionEnd) return

  let index = input.selectionStart

  const before = input.value.slice(0, index)
  if (!before.endsWith('\n-')) return

  const after = input.value.slice(index)

  const tableName = before.split('\n').slice(-2)[0]
  if (!tableName) return

  const mid = '-'.repeat(tableName.length - 1) + '\nid\n'

  input.value = before + mid + after
  index += mid.length

  input.selectionStart = index
  input.selectionEnd = index
}

try {
  new MutationObserver(() => {
    localStorage.setItem('input_width', input.style.width)
  }).observe(input, { attributes: true })
} catch (error) {
  console.error('MutationObserver not supported')
}

function parseInput() {
  const result = parse(input.value)
  diagramController.render(result)
  if (result.textBgColor) {
    colorController.textBgColor.applyParsedColor(result.textBgColor)
  }
  if (result.textColor) {
    colorController.textColor.applyParsedColor(result.textColor)
  }
  if (result.diagramBgColor) {
    colorController.diagramBgColor.applyParsedColor(result.diagramBgColor)
    colorController.updateDiagramTextColor()
  }
  if (result.tableBgColor) {
    colorController.tableBgColor.applyParsedColor(result.tableBgColor)
  }
  if (result.tableTextColor) {
    colorController.tableTextColor.applyParsedColor(result.tableTextColor)
  }
}
input.addEventListener('input', parseInput)

document.querySelector('#export')?.addEventListener('click', () => {
  const dialog = openDialog(diagramController)
  dialog.innerHTML = /* html */ `
<textarea cols=30></textarea>
<p style='color: black'>not copied in clipboard</p>
<button class='cancel'>close</button>
<button class='confirm'>copy</button>
`
  const textarea = dialog.querySelector('textarea') as HTMLTextAreaElement
  const p = dialog.querySelector('p') as HTMLDivElement
  const json = { input: input.value }
  diagramController.exportJSON(json)
  textarea.value = JSON.stringify(json)
  dialog.querySelector('.cancel')?.addEventListener('click', () => {
    dialog.remove()
  })
  dialog.querySelector('.confirm')?.addEventListener('click', () => {
    textarea.select()
    if (document.execCommand('copy')) {
      p.textContent = 'copied to clipboard'
      p.style.color = 'green'
    } else {
      p.textContent =
        'copy to clipboard is not supported, please copy it manually'
      p.style.color = 'red'
    }
  })
})

document.querySelector('#import')?.addEventListener('click', () => {
  const dialog = openDialog(diagramController)
  dialog.innerHTML = /* html */ `
<textarea cols=30></textarea>
<p style='color: black'>not imported yet</p>
<button class='cancel'>close</button>
<button class='confirm'>import</button>
`
  const textarea = dialog.querySelector('textarea') as HTMLTextAreaElement
  const p = dialog.querySelector('p') as HTMLDivElement
  dialog.querySelector('.cancel')?.addEventListener('click', () => {
    dialog.remove()
  })
  dialog.querySelector('.confirm')?.addEventListener('click', () => {
    try {
      const json = JSON.parse(textarea.value)

      const zoom = +json.zoom
      if (zoom) {
        input.value = ''
        parseInput()
        diagramController.zoom.value = zoom
        diagramController.applyFontSize()
      }

      Object.assign(localStorage, json)

      input.value = json.input
      parseInput()

      p.textContent = 'import successfully'
      p.style.color = 'green'
    } catch (error) {
      p.textContent = 'invalid json'
      p.style.color = 'red'
    }
  })
})

document.querySelector('#load-example')?.addEventListener('click', () => {
  if (!input.value.trim()) {
    loadExample()
    return
  }
  const dialog = openDialog(diagramController)
  dialog.innerHTML = /* html */ `
<p>Confirm to overwrite existing content with example?</p>
<button class='cancel'>cancel</button>
<button class='danger'>confirm</button>
`
  dialog.querySelector('.cancel')?.addEventListener('click', () => {
    dialog.remove()
  })
  dialog.querySelector('.danger')?.addEventListener('click', () => {
    loadExample()
    dialog.remove()
  })
})

function loadExample() {
  input.value = `
${makeGuide(location.origin)}


user
----
id pk
username varchar(64)


post
----
id pk
author_id fk >- user.id
content text
status enum('active','pending')


reply
-----
id pk
# column "{table}_id" ends with "fk" will be interpreted as implicitly referencing to
# "{table}.id" with ">-" relationship
post_id fk # e.g. post_id references to post.id
user_id fk
reply_id null fk # it's fine to include other modifiers in the middle
content text
`.trim()
  parseInput()
}

document.querySelector('#format')?.addEventListener('click', format)

function format() {
  diagramController.flushToInputController()
  colorController.flushToInputController()
  const result = parse(input.value)
  input.value = astToText(result) + '\n'
}

document.querySelector('#normalize')?.addEventListener('click', showNormalize)

function showNormalize() {
  const dialog = openDialog(diagramController)
  dialog.innerHTML = /* html */ `
<label for="field">field:</label>
<br>
<input id="field" name="field" type="text">
<br>
<br>
<label for="table">table (optional):</label>
<br>
<input id="table" name="table" type="text">
<br>
<br>
<button class='cancel'>close</button>
<button class='confirm'>normalize</button>
`
  dialog.querySelector('.cancel')?.addEventListener('click', () => {
    dialog.remove()
  })
  dialog.querySelector('.confirm')?.addEventListener('click', () => {
    applyNormalize()
  })
  const field = dialog.querySelector('input[name=field]') as HTMLInputElement
  const table = dialog.querySelector('input[name=table]') as HTMLInputElement
  field.addEventListener('keypress', onKeypress)
  table.addEventListener('keypress', onKeypress)
  function onKeypress(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      applyNormalize()
    }
  }
  function applyNormalize() {
    const fieldName = field.value.trim()
    if (!fieldName) return
    const tableName = table.value.trim() || fieldName
    input.value = normalize(input.value, fieldName, tableName)
    parseInput()
    localStorage.setItem('input', input.value)
  }
  field.focus()
}

document.querySelector('#auto-place')?.addEventListener('click', () => {
  diagramController.autoPlace()
})

document.querySelector('#toggle-details')?.addEventListener('click', () => {
  diagramController.toggleDetails()
})

document.querySelector('#random-color')?.addEventListener('click', () => {
  diagramController.randomColor()
})

document.querySelector('#reset-color')?.addEventListener('click', () => {
  colorController.resetColors()
  diagramController.resetColor()
})

document.querySelector('#reset-zoom')?.addEventListener('click', () => {
  diagramController.resetView()
})

function closeDialog() {
  const es = document.querySelectorAll('dialog')
  const last = es.item(es.length - 1)
  if (last) {
    last.remove()
  }
}

window.addEventListener('keypress', e => {
  const tagName = document.activeElement?.tagName
  if (tagName === 'TEXTAREA' || tagName === 'INPUT') return
  switch (e.key) {
    case '-':
    case '_':
      diagramController.fontDec()
      return
    case '+':
    case '=':
      diagramController.fontInc()
      return
    case 'a':
    case 'A':
      diagramController.autoPlace()
      return
    case 'd':
    case 'D':
      diagramController.toggleDetails()
      return
    case 'c':
    case 'C':
      diagramController.randomColor()
      return
    case '0':
      diagramController.fontReset()
      return
    case 'r':
    case 'R':
      diagramController.resetView()
      return
    case 'n':
    case 'N':
      showNormalize()
      return
    case 'q':
    case 'Q':
      closeDialog()
      return
    default:
    // console.debug(e.key)
  }
})

parseInput()
