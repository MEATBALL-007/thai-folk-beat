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
  molam: [
    {
      image: 'comic.molam.1',
      captionTh:
        'หมอลำ คือการขับลำของชาวอีสาน ผู้ขับร้องเรียกว่า “หมอลำ” ส่วนผู้เป่าแคนประกอบเรียกว่า “หมอแคน”',
    },
    {
      image: 'comic.molam.2',
      captionTh:
        'ลำกลอน เป็นการลำโต้ตอบระหว่างหมอลำชายและหญิง ต้องใช้ไหวพริบด้นกลอนสดโต้กันไปมา',
    },
    {
      image: 'comic.molam.3',
      captionTh:
        'แคน เป็นเครื่องดนตรีหลัก ทำจากไม้ซางมัดเรียงกัน มีลิ้นโลหะ เป่าได้ทั้งลมเข้าและลมออก จึงมีเสียงต่อเนื่องไม่ขาดสาย',
    },
    {
      image: 'comic.molam.4',
      captionTh:
        'ทุกวันนี้หมอลำแตกออกเป็นหลายแบบ ทั้งลำกลอน ลำเรื่อง และหมอลำซิ่งที่ผสมดนตรีสมัยใหม่เข้าไป',
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
