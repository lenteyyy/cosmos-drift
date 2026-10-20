export function selectEnglishVoice(voices) {
  const english = voices.filter(
    (voice) =>
      /^en[-_]/i.test(voice.lang) &&
      !/Whisper|Zarvox|Trinoids|Bells|Boing|Fred|Ralph|Bad News|Good News|Organ|Bubbles/i.test(
        voice.name,
      ),
  );
  return (
    english.find((voice) => /natural|neural|premium|enhanced/i.test(voice.name)) ||
    english.find((voice) => /Samantha|Ava|Serena|Google UK English Female/i.test(voice.name)) ||
    english[0] ||
    null
  );
}
