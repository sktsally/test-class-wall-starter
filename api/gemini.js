// ===================================================
// Gemini API 호출 서버리스 함수 (Vercel)
// 주소: /api/gemini
//
// API 키는 Vercel 환경변수(GEMINI_API_KEY)에서 가져옵니다.
// 개인정보 보호: uid, 이메일 등의 식별 정보는 Gemini에 보내지 않습니다.
// 무료 티어 모델: gemini-1.5-flash
// ===================================================

export default async function handler(req, res) {
  // POST 요청만 허용합니다.
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST 요청만 지원합니다." });
  }

  const { text } = req.body || {};

  // 메모 내용 유효성 검사
  if (!text || typeof text !== "string" || text.trim() === "") {
    return res.status(400).json({ error: "메모 내용(text)이 필요합니다." });
  }

  // Vercel 환경변수에서 Gemini API 키를 가져옵니다.
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "Vercel 환경변수에 GEMINI_API_KEY가 설정되어 있지 않습니다. Vercel 대시보드(Settings > Environment Variables)에서 등록해 주세요."
    });
  }

  try {
    // 무료로 사용 가능한 Gemini 1.5 Flash 모델 사용
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    // 학생을 격려하는 따뜻한 교사 관점의 프롬프트 구성 (개인 식별 정보 제외)
    const prompt = `당신은 학생들을 따뜻하게 격려하고 칭찬해 주는 친절한 선생님의 AI 도우미입니다.
학생이 학급 담벼락에 작성한 다음 메모 내용을 읽고, 학생에게 힘이 되고 생각을 넓혀 줄 수 있는 따뜻하고 긍정적인 코멘트를 1~2문장으로 짧게 작성해 주세요. (친근한 말투와 이모지 사용)

[학생 메모]
${text.trim()}

[선생님 AI 코멘트]`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          maxOutputTokens: 200,
          temperature: 0.7
        }
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      return res.status(response.status).json({
        error: errData.error?.message || "Gemini API 호출에 실패했습니다."
      });
    }

    const data = await response.json();
    const comment = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "코멘트를 생성하지 못했습니다.";

    return res.status(200).json({ comment });
  } catch (error) {
    console.error("Gemini API 호출 오류:", error);
    return res.status(500).json({ error: "서버 오류가 발생했습니다: " + error.message });
  }
}
