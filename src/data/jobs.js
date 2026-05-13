export const RAW_CSV = `Job,Mfr,Model,Status,Days,Tag,Hours,HoursRaw,Blockers,Desc,VB
97,DB Tech,Opera 405D,Booked In,3074,T,0,,diagnose,Won't power up after high voltage spike,N
393,Fender,Passport 500 Pro,Booked In,2135,H,2.5,2-3,confidence,Blows fuses 10A apparently,N
693,Fender,Passport PD-250,Booked In,1515,H,3.5,3-4,diagnose,Powers up no o/p,N
875,RCF,ART312A,Active,1171,T,3.5,3-4,,No o/p after moving amp suspect rough handling,N
1175,Allen & Heath,GL2800,Active,649,M,6,6,,Appears dead no lights modular,N
1345,Hughes & Kettner,Switchblade 100,Active,406,M,2.5,2-3,burn tubes in,Blown anode fuse suspect bad tubes,N
1382,Alegria,25,Booked In,343,T,4,3-5,confidence in tools,Lifted bridge bowed neck,N
1448,Gibson,Hummingbird Pro,Active,268,T,4,3-5,confidence,Broken neck stp 3yrs in storage,N
1480,Fender,Vibro Champ,Active,215,M,2.5,2-3,diagnose,Powers up no output tubes test good,N
1491,Eko,Modello,Booked In,197,M,4,3-5,diagnose job,Nut saddle braces binding finish cracks stp,N
1505,Fender,Princeton 112 Plus,Active,182,M,2.5,2-3,replace MFets test output,DOA power to tx nothing after,N
1513,Behringer,S32 Stage Box,Booked In,178,T,3.5,3-4,product knowledge,Mute all button fault,N
1520,Ampeg,SVT 6 Pro,Active,172,M,6,6,time,Powers up no output replace 125mA fuse,N
1543,Mackie,SRM450,Active,157,EZ,1,1,,No output,N
1544,BeesNeez,Lulu Fet,Booked In,157,M,2.5,2-3,disassembly and circuit knowledge,Self noise issues,N
1586,Yamaha,Dynamic 040,Active,116,M,7,6-8,,Refret cracked top x3 stiff tuners strap buttons,N
1609,QTX,Sound 2.1 Live Set,Booked In,79,M,2.5,2-3,diagnose job,Only 2 inputs working,N
1621,Aria,Diamond 1202T,Booked In,61,M,7,6-8,diagnose neck pocket first,Restoration neck pocket refret bone nut pups stp,N
1626,Taylor,114CE,Booked In,56,T,3.5,3-4,diagnose and confidence moving pickguard,Poss neck reset high action pickguard strings,N
1628,Martin,000-16 GT,Booked In,53,M,2.5,2-3,,VB top crack in body and pup has fallen,Y
1629,Cort,SFX-10 NAT,Booked In,51,M,3.5,3-4,,Broken lower bout area loose brace restring,N
1635,Epiphone,Les Paul Ultra,Booked In,37,M,6.5,6-7,,Broken neck fret level stp nut scratchy pots jack,N
1636,Medeli,M221L,Booked In,37,M,2.5,2-3,customer contact,VB one key not working,Y
1637,Martin,DCPA5,Booked In,37,M,2.5,2-3,,Crack in body loose brace restring,N
1638,Tanglewood,TW28 SLN CE,Booked In,31,M,3,2-4,,Broken lower bout change jack restring,N
1639,Marshall,DSL-15,Booked In,28,M,2,2,tubes,No output after new power tubes rattly preamp,N
1641,Martin,18,Booked In,26,EZ,1.5,1-2,bone bridge pins,VB new guitar setup bone bridge pins,Y
1646,Jackson,Super strat,Booked In,18,EZ,2.5,2.5,,Setup SIC,N
1647,Marshall,Haze 40,Booked In,13,M,2.5,2-3,diagnose test tubes,Loud bang and no output possibly tubes,N
1648,Yamaha,Dynamic 2,Booked In,12,M,5.5,5-6,,Top cracks x3 bridge lifting nut saddle clean,N
1649,Casio,CDP-S100,Booked In,12,EZ,1.5,1-2,buy power supply,Lost power supply source new supply,N
1651,G&L,ASAT Classic,Booked In,0,EZ,1.8,1-2.5,,VB bone nut setup,Y`;

export function inferBench(desc = '') {
  const d = desc.toLowerCase();
  if (/refret|fret level|fret dress|fret polish/.test(d)) return 'Fretwork';
  if (/refret|fret|nut|saddle|bridge|crack|brace|reset|neck|pocket|top|lower bout/.test(d)) return 'Luthier';
  if (/power|output|tube|fuse|amp|recap|blown|no o\/p/.test(d)) return 'Electronics';
  if (/setup|stp|intonation|pups|pickup|wiring|strings/.test(d)) return 'Setup';
  return 'Admin';
}

export function parseCSV(csvText) {
  const lines = csvText.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  const jobs = [];

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].match(/(".*?"|[^,]+|(?<=,)(?=,)|(?<=,)$|^(?=,))/g) || [];
    const clean = row.map(v => v ? v.replace(/^"|"$/g, '').trim() : '');
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = clean[idx] || ''; });

    const status = obj.Status || '';
    const hours = parseFloat(obj.Hours) || 0;
    if (!['Active', 'Booked In'].includes(status)) continue;
    if (hours === 0) continue;

    const bench = inferBench(obj.Desc);
    jobs.push({
      id: String(obj.Job),
      job: obj.Job,
      mfr: obj.Mfr,
      model: obj.Model,
      status,
      days: parseInt(obj.Days) || 0,
      tag: obj.Tag,
      hours,
      hoursRaw: obj.HoursRaw,
      blockers: obj.Blockers,
      desc: obj.Desc,
      vb: obj.VB === 'Y',
      bench,
      scheduled: false,
      calendarSlot: null,
    });
  }

  return jobs.sort((a, b) => b.days - a.days);
}

export const BENCH_COLORS = {
  Luthier:     { bg: '#166534', border: '#15803d', text: '#bbf7d0' },
  Electronics: { bg: '#1e3a5f', border: '#2563eb', text: '#bfdbfe' },
  Setup:       { bg: '#7c2d12', border: '#ea580c', text: '#fed7aa' },
  Fretwork:    { bg: '#4c1d95', border: '#7c3aed', text: '#ddd6fe' },
  Admin:       { bg: '#374151', border: '#6b7280', text: '#e5e7eb' },
};
