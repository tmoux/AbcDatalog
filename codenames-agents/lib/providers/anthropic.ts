import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export interface CompletionConfig {
  model: string
  systemPrompt: string
  temperature: number
}

export async function streamCompletion(
  config: CompletionConfig,
  userMessage: string,
  onToken: (token: string) => void,
): Promise<string> {
  let fullText = ''

  const stream = client.messages.stream({
    model: config.model,
    max_tokens: 4096,
    temperature: config.temperature,
    system: config.systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  })

  stream.on('text', (text: string) => {
    fullText += text
    onToken(text)
  })

  await stream.finalMessage()

  return fullText
}
