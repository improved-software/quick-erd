import { parse } from './ast'
import { DiagramController } from './diagram'
const input = document.querySelector('#editor textarea') as HTMLTextAreaElement
const diagram = document.querySelector('#diagram') as HTMLDivElement

const diagramController = new DiagramController(diagram)

input.value = localStorage.getItem('input') || input.value
input.style.width = localStorage.getItem('input_width') || ''

window.addEventListener('storage', () => {
  input.value = localStorage.getItem('input') || input.value
})

input.addEventListener('input', () => {
  localStorage.setItem('input', input.value)
})

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
}
input.addEventListener('input', parseInput)
setTimeout(parseInput)

document.querySelector('#load-example')?.addEventListener('click', () => {
  if (!input.value.trim()) {
    loadExample()
    return
  }
  const dialog = document.createElement('dialog')
  dialog.style.zIndex = diagramController.getSafeZIndex().toString()
  dialog.setAttribute('open', '')
  document.body.appendChild(dialog)
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
# comment starts with hash

user
----
id pk
username text

post
----
id pk
user_id fk >- user.id

reply
-----
id pk
post_id fk >- post.id
user_id fk >- user.id
reply_id null fk >- reply.id
`.trim()
  parseInput()
}

document.querySelector('#auto-place')?.addEventListener('click', () => {
  diagramController.autoPlace()
})
