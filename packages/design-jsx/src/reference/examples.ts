import dedent from 'dedent'

export interface AuthoringExample {
  title: string
  jsx: string
}

/** Shared verbatim by runtime prompts and the installable skill; exercised in engine tests. */
export const AUTHORING_EXAMPLES: readonly AuthoringExample[] = [
  {
    title: 'Card background with a gradient scrim',
    jsx: dedent`<Frame name="Photo card" w={280} h={400} flex="col" justify="end" p={24} rounded={20} cornerSmoothing={0.6}
  fills={[solid('#B5C7C3'), linearGradient([['#00000000', 0], ['#000000CC', 1]],
  {transform: {m00: 0, m01: 1, m02: 0.5, m10: -1, m11: 0, m12: 1}})]}>
  <Text name="Caption" size={24} color="#FFFFFF">A place to unwind</Text>
</Frame>`
  },
  {
    title: 'Content-sized review note',
    jsx: dedent`<Frame name="Review note" w={280} h="hug" flex="col" gap={8} p={16} bg="#FFFFFF">
  <Text name="Author" size={12} weight="medium" color="#252A31">June Lee</Text>
  <Text name="Message" w="fill" size={12} color="#6B7079">Give the date a little more room at the bottom.</Text>
</Frame>`
  },
  {
    title: 'Variable-bound spacing and typography',
    jsx: dedent`<Frame name="Bound note" w={280} h="hug" flex="col" gap={designVar('Space/small')} p={designVar('Space/medium')} bg="#FFFFFF">
  <Text name="Message" w="fill" size={designVar('Type/body')} lineHeight={designVar('Type/body-leading')} letterSpacing={designVar('Type/body-tracking')} color="#252A31">A note that grows with its content.</Text>
</Frame>`
  }
]
