import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const SPEECH_REGION = process.env.GOOGLE_SPEECH_REGION || 'us';
const METADATA_BASE = 'http://metadata.google.internal/computeMetadata/v1';

const PHRASES = [
  'Loopora',
  'CartPilot',
  'Starbucks Coffee Company',
  'Starbucks',
  'Truffles Cafe',
  'Truffles',
  'Tower Cafe',
  "Peet's Coffee & Tea",
  "Peet's Coffee",
  'Spice Kitchen',
  'South Delight',
  'Sweet Treats Bakery',
  'coffee',
  'espresso',
  'cappuccino',
  'latte',
  'Americano',
  'biryani',
  'Chicken Biryani',
  'Veg Biryani',
  'Hyderabadi Biryani',
  'basmati rice',
  'ingredients',
  'merchant',
  'checkout',
];

async function metadata(path: string): Promise<string> {
  const response = await fetch(`${METADATA_BASE}/${path}`, {
    headers: { 'Metadata-Flavor': 'Google' },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Metadata request failed: ${response.status}`);
  return response.text();
}

async function getProjectId(): Promise<string> {
  return (
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    process.env.GCP_PROJECT ||
    (await metadata('project/project-id'))
  ).trim();
}

async function getAccessToken(): Promise<string> {
  const response = await fetch(`${METADATA_BASE}/instance/service-accounts/default/token`, {
    headers: { 'Metadata-Flavor': 'Google' },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Could not obtain Cloud Run service-account token: ${response.status}`);
  const data = await response.json();
  if (!data?.access_token) throw new Error('Cloud Run metadata server returned no access token.');
  return data.access_token as string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const audio = typeof body?.audio === 'string' ? body.audio : '';
    const requestedLanguage = typeof body?.language === 'string' ? body.language : 'en-IN';

    if (!audio) {
      return NextResponse.json({ success: false, error: 'Audio is required.' }, { status: 400 });
    }

    // Keep synchronous requests comfortably below the one-minute use case.
    if (audio.length > 12_000_000) {
      return NextResponse.json({ success: false, error: 'Audio clip is too large.' }, { status: 413 });
    }

    const [projectId, accessToken] = await Promise.all([getProjectId(), getAccessToken()]);
    const endpoint = `https://${SPEECH_REGION}-speech.googleapis.com/v2/projects/${encodeURIComponent(projectId)}/locations/${SPEECH_REGION}/recognizers/_:recognize`;

    const speechResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        config: {
          autoDecodingConfig: {},
          languageCodes: [requestedLanguage, 'en-US'],
          model: 'chirp_3',
          features: {
            enableAutomaticPunctuation: true,
          },
          adaptation: {
            phraseSets: [
              {
                inlinePhraseSet: {
                  boost: 12,
                  phrases: PHRASES.map((value) => ({ value })),
                },
              },
            ],
          },
        },
        content: audio,
      }),
      cache: 'no-store',
    });

    const data = await speechResponse.json().catch(() => ({}));
    if (!speechResponse.ok) {
      console.error('Cloud Speech-to-Text error', speechResponse.status, data);
      return NextResponse.json(
        {
          success: false,
          error: data?.error?.message || 'Google Speech-to-Text is unavailable.',
          fallback: true,
        },
        { status: speechResponse.status >= 500 ? 503 : speechResponse.status }
      );
    }

    const transcript = Array.isArray(data?.results)
      ? data.results
          .map((result: any) => result?.alternatives?.[0]?.transcript || '')
          .filter(Boolean)
          .join(' ')
          .trim()
      : '';

    return NextResponse.json({
      success: true,
      transcript,
      provider: 'google-chirp-3',
    });
  } catch (error) {
    console.error('Speech transcription endpoint error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Speech transcription failed.',
        fallback: true,
      },
      { status: 503 }
    );
  }
}
