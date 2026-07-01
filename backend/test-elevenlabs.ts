import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
    const apiKey = process.env.ELEVENLABS_API_KEY
    const res = await fetch('https://api.elevenlabs.io/v1/voices', {
      method: 'GET',
      headers: {
        'xi-api-key': apiKey || '',
      }
    })
    const data: any = await res.json()
    console.log(JSON.stringify(data, null, 2))
}

run();
