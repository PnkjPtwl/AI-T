import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
    const apiKey   = process.env.ANAM_API_KEY
    const avatarId = process.env.ANAM_AVATAR_ID

    if (!apiKey || !avatarId) {
        console.error('Anam API key or Avatar ID not configured')
        return
    }

    // Get avatars
    const avatarsRes = await fetch('https://api.anam.ai/v1/avatars', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      }
    })
    const avatars: any = await avatarsRes.json()
    const liv = avatars.data.find((a: any) => a.displayName === 'Liv')
    console.log("Liv avatar:", JSON.stringify(liv, null, 2))
}

run();
