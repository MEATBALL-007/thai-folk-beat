export interface ComicPanel {
  /** Asset key from the manifest; falls back to a placeholder if missing. */
  image: string;
  captionTh: string;
  /**
   * Spec §5.5: no voice-over has been recorded yet. The field and the play call
   * are wired and null-guarded, so dropping in audio later needs no code change.
   */
  voiceUrl?: string;
}

/**
 * Origin comics (spec §5.5). Captions are real, accurate content about each
 * genre rather than lorem — this is a school project and a teacher will read it.
 */
export const COMICS: Record<string, ComicPanel[]> = {
  // Two panels, with the text the designer wrote (2026-09-14). It replaced the
  // four-panel version wholesale — this is their account of where หมอลำ came
  // from, so it is reproduced as written rather than re-edited.
  molam: [
    {
      image: 'comic.molam.1',
      captionTh:
        'เดิมทีสมัยโบราณ คุณปู่คุณย่าช่วงเวลาค่ำก็มักจะเล่านิทานให้ลูกหลานฟังเกี่ยวกับวรรณคดี แต่ด้วยการเล่าไม่ออกท่าทางทำให้เด็กเบื่อ จึงต้องทำท่าทางเพื่อให้เกิดความสนุกสนาน',
    },
    {
      image: 'comic.molam.2',
      captionTh:
        'ต่อมาด้วยการเล่าอย่างเดียวไม่สนุกสนาน จึงนำเอาเครื่องดนตรีอย่างแคนมาเพื่อสร้างความสนุก แต่ด้วยการแสดงเดี่ยวทำให้ไม่มีสีสัน จึงนำผู้หญิงมาแสดงด้วย เมื่อผู้หญิงมาเกี่ยวข้องทำให้มีเรื่องความรักมาเกี่ยวข้องในเนื้อเพลง จึงเกิดเป็นหมอลำจนถึงปัจจุบัน',
    },
  ],
  soeng: [
    {
      image: 'comic.soeng.1',
      captionTh: 'เซิ้ง เป็นการฟ้อนรำเป็นหมู่ของชาวอีสาน มักแสดงในงานบุญและขบวนแห่ของหมู่บ้าน',
    },
    {
      image: 'comic.soeng.2',
      captionTh:
        'งานบุญบั้งไฟ จะมีการเซิ้งบั้งไฟไปตามขบวน เพื่อขอฝนจากพญาแถนก่อนถึงฤดูทำนา',
    },
    {
      image: 'comic.soeng.3',
      captionTh:
        'จังหวะเซิ้งเร็วและหนักแน่น นำด้วยกลองยาว ฉิ่งและฉาบ คุมให้คนทั้งขบวนก้าวพร้อมกัน',
    },
    {
      image: 'comic.soeng.4',
      captionTh:
        'ท่าเซิ้งเรียบง่ายและซ้ำได้ ใครก็ร่วมได้ จึงเป็นการละเล่นที่ดึงคนทั้งหมู่บ้านมาอยู่ด้วยกัน',
    },
  ],
};

export function panelsFor(songId: string): ComicPanel[] {
  return COMICS[songId] ?? [];
}
