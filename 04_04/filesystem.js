const DIACRITICS = {
  'ą': 'a', 'ć': 'c', 'ę': 'e', 'ł': 'l', 'ń': 'n',
  'ó': 'o', 'ś': 's', 'ź': 'z', 'ż': 'z',
}

export function normalizeName(name) {
  return name
    .toLowerCase()
    .replace(/[ąćęłńóśźż]/g, c => DIACRITICS[c] || c)
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 20)
}

export function buildBatchActions(data) {
  const actions = [
    {action: 'reset'},
    {action: 'createDirectory', path: '/miasta'},
    {action: 'createDirectory', path: '/osoby'},
    {action: 'createDirectory', path: '/towary'},
  ]

  for (const [city, goods] of Object.entries(data.cities)) {
    const normalizedGoods = Object.fromEntries(
      Object.entries(goods).map(([k, v]) => [normalizeName(k), v])
    )
    actions.push({
      action: 'createFile',
      path: `/miasta/${normalizeName(city)}`,
      content: JSON.stringify(normalizedGoods),
    })
  }

  for (const [person, city] of Object.entries(data.people)) {
    const cityFile = normalizeName(city)
    actions.push({
      action: 'createFile',
      path: `/osoby/${normalizeName(person)}`,
      content: `${person}\n\n[${city}](/miasta/${cityFile})`,
    })
  }

  for (const [good, cities] of Object.entries(data.goods)) {
    const links = cities.map(c => `[${c}](/miasta/${normalizeName(c)})`).join('\n')
    actions.push({
      action: 'createFile',
      path: `/towary/${normalizeName(good)}`,
      content: links,
    })
  }

  return actions
}
