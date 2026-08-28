import { db } from './db.js';

/**
 * Async background task to analyze chat interactions and auto-learn skills using Gemini.
 */
export async function aprenderSkillAutomatico(consulta, contextoNormas, respuestaTexto) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log('[AUTO-LEARNING] Gemini API key not configured. Skipping learning step.');
    return;
  }

  try {
    const prompt = `
Analiza la siguiente interacción de un Asistente de IA de la empresa Carpas D'Angiola:
Consulta del usuario: "${consulta}"
Normas/Manuales de referencia: "${contextoNormas}"
Respuesta correcta generada: "${respuestaTexto}"

Si el asistente respondió correctamente la consulta basándose en la norma/manual de referencia, genera una habilidad auto-aprendida (Auto-Skill) en formato JSON para que en el futuro el asistente sepa exactamente qué reglas o respuestas aplicar cuando el usuario pregunte por este tema o palabras clave.

Responde ÚNICAMENTE con un objeto JSON válido (sin markdown, sin bloques \`\`\`json, solo el JSON plano) con la estructura:
{
  "nombre": "Nombre descriptivo corto de la habilidad (ej: Regla ISO 9001 - Control de Lonas)",
  "trigger_keywords": "3 a 5 palabras clave separadas por comas",
  "instrucciones": "Instrucción de comportamiento detallada en español para el agente"
}

Si consideras que la interacción no es relevante para crear una habilidad permanente, o no se usó la norma para responder, responde únicamente con el texto exacto: NO_SKILL
`;

    const geminiPayload = {
      contents: [{
        parts: [{ text: prompt }]
      }]
    };

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiPayload)
    });

    if (!response.ok) {
      console.warn(`[AUTO-LEARNING] Gemini call failed with status ${response.status}`);
      return;
    }

    const json = await response.json();
    let text = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
    text = text.trim();

    if (text.includes("NO_SKILL")) {
      console.log('[AUTO-LEARNING] No se dedujo ninguna habilidad permanente de esta interacción.');
      return;
    }

    // Clean up codeblock if markdown syntax is generated
    if (text.startsWith("```")) {
      text = text.replace(/^```(json)?\n/, "");
      text = text.replace(/\n```$/, "");
      text = text.trim();
    }

    const skillData = JSON.parse(text);
    const { nombre, trigger_keywords, instrucciones } = skillData;

    if (nombre && instrucciones) {
      await db.saveSkill({
        nombre,
        descripcion: `Auto-aprendida por consulta: "${consulta.substring(0, 50)}..."`,
        trigger_keywords,
        instrucciones
      });
      console.log(`[AUTO-LEARNING] Nueva habilidad registrada con éxito: "${nombre}"`);
    }
  } catch (e) {
    console.error("[AUTO-LEARNING] Error en proceso de auto-aprendizaje asíncrono:", e);
  }
}
