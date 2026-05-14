export interface SocialGifItem {
  id: string
  label: string
  category: 'Popüler' | 'Kutlama' | 'Tepki' | 'Komik'
  tags: string[]
  url: string
}

export const SOCIAL_GIF_CATALOG: SocialGifItem[] = [
  {
    id: 'clap',
    label: 'Alkış',
    category: 'Popüler',
    tags: ['alkış', 'clap', 'bravo', 'kutlama'],
    url: 'https://media.giphy.com/media/26u4lOMA8JKSnL9Uk/giphy.gif'
  },
  {
    id: 'happy-dance',
    label: 'Mutlu Dans',
    category: 'Kutlama',
    tags: ['dans', 'mutlu', 'sevinc', 'kutlama'],
    url: 'https://media.giphy.com/media/111ebonMs90YLu/giphy.gif'
  },
  {
    id: 'thumbs-up',
    label: 'Onay',
    category: 'Popüler',
    tags: ['onay', 'tamam', 'thumbs up', 'iyi'],
    url: 'https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif'
  },
  {
    id: 'mind-blown',
    label: 'Şaşkın',
    category: 'Tepki',
    tags: ['saskin', 'wow', 'mind blown', 'şaşkın'],
    url: 'https://media.giphy.com/media/xT0xeJpnrWC4XWblEk/giphy.gif'
  },
  {
    id: 'facepalm',
    label: 'Facepalm',
    category: 'Tepki',
    tags: ['facepalm', 'off', 'yuh', 'tepki'],
    url: 'https://media.giphy.com/media/3og0INyCmHlNylks9O/giphy.gif'
  },
  {
    id: 'laugh',
    label: 'Kahkaha',
    category: 'Komik',
    tags: ['gülmek', 'kahkaha', 'komik', 'lol'],
    url: 'https://media.giphy.com/media/10JhviFuU2gWD6/giphy.gif'
  },
  {
    id: 'popcorn',
    label: 'Popcorn',
    category: 'Komik',
    tags: ['popcorn', 'izliyorum', 'dram', 'komik'],
    url: 'https://media.giphy.com/media/NipFetnQOuKhW/giphy.gif'
  },
  {
    id: 'fire',
    label: 'Alev',
    category: 'Popüler',
    tags: ['fire', 'alev', 'harika', 'iyi'],
    url: 'https://media.giphy.com/media/5xtDarIN81U0KvlnzKo/giphy.gif'
  },
  {
    id: 'celebrate',
    label: 'Kutlama',
    category: 'Kutlama',
    tags: ['kutlama', 'party', 'tebrik', 'sevinc'],
    url: 'https://media.giphy.com/media/3KC2jD2QcBOSc/giphy.gif'
  },
  {
    id: 'hello',
    label: 'Selam',
    category: 'Popüler',
    tags: ['selam', 'hello', 'merhaba'],
    url: 'https://media.giphy.com/media/ASd0Ukj0y3qMM/giphy.gif'
  },
  {
    id: 'cry',
    label: 'Ağlıyorum',
    category: 'Tepki',
    tags: ['uzgun', 'aglamak', 'sad', 'tepki'],
    url: 'https://media.giphy.com/media/OPU6wzx8JrHna/giphy.gif'
  },
  {
    id: 'ok',
    label: 'Tamam',
    category: 'Tepki',
    tags: ['ok', 'tamam', 'anlastik', 'onay'],
    url: 'https://media.giphy.com/media/l0IykG0AM7911MrCM/giphy.gif'
  }
]
