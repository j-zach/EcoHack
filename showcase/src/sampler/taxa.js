// Illustrative fungal guilds. Lifecycle numbers are in simulated days.
export const TAXA = [
  { key: 'sap', name: 'Wood saprotroph', short: 'Saprotroph', css: '#ff8c42', color: 0xff8c42,
    lag: [1.5, 3], emerge: 1.2, spore: [2, 3], collapse: 1.2, cooldown: [3, 7], thr: 0.6, rate: 60 },
  { key: 'ecm', name: 'Ectomycorrhizal', short: 'Ectomycorrhizal', css: '#ffd23f', color: 0xffd23f,
    lag: [3, 5], emerge: 1.5, spore: [1.5, 2.5], collapse: 1.0, cooldown: [5, 10], thr: 0.9, rate: 55 },
  { key: 'pat', name: 'Plant pathogen', short: 'Pathogen', css: '#e056fd', color: 0xe056fd,
    lag: [1, 2], emerge: 0.8, spore: [1, 2], collapse: 0.8, cooldown: [2, 5], thr: 0.45, rate: 45 },
  { key: 'myc', name: 'Mycena-like (bioluminescent)', short: 'Mycena-like', css: '#4dffb5', color: 0x4dffb5,
    lag: [0.8, 1.6], emerge: 0.7, spore: [1, 1.6], collapse: 0.7, cooldown: [2, 4], thr: 0.35, rate: 40 },
];
