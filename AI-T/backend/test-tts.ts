import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
    const apiKey = process.env.ELEVENLABS_API_KEY
    const voiceId = 'EXAVITQu4vr4xnSDxMaL' // Bella

    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=pcm_16000`, {
        method: 'POST',
        headers: {
            'xi-api-key': apiKey || '',
            'Content-Type': 'application/json',
            'Accept': 'audio/pcm',
        },
        body: JSON.stringify({
            text: 'Hello, this is a test.',
            model_id: 'eleven_turbo_v2_5',
        }),
    })

    if (!res.ok) {
        console.error('Failed:', res.status, await res.text())
    } else {
        const buffer = Buffer.from(await res.arrayBuffer())
        console.log('Success! Bytes:', buffer.length)
    }
}

run();
