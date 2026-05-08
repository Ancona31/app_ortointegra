import StarterKit from '@tiptap/starter-kit'
import UnderlineExt from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import Placeholder from '@tiptap/extension-placeholder'

// Lista de extensiones — exportada para reuso en Phase 3
// (visor + email rendering del JSON con el mismo schema).
// Módulo neutro (sin 'use client') para que pueda ser importado
// desde Route Handlers server-side sin arrastrar el árbol de cliente.
export const editorExtensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
  }),
  UnderlineExt,
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  Placeholder.configure({
    placeholder: 'Redacta aquí el contenido del documento...',
  }),
]
