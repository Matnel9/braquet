const ResEdit = require('/home/claude/libs/node_modules/resedit'); const fs = require('fs');
const exePath = process.argv[2] || 'dist/win-unpacked/Braquet.exe';
const exe = ResEdit.NtExecutable.from(fs.readFileSync(exePath), { ignoreCert: true });
const res = ResEdit.NtExecutableResource.from(exe);
const ico = ResEdit.Data.IconFile.from(fs.readFileSync('build-icon.ico'));
const groups = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries);
console.log('icon groups', groups.map(g => g.id + '/' + g.lang));
for (const g of groups) ResEdit.Resource.IconGroupEntry.replaceIconsForResource(res.entries, g.id, g.lang, ico.icons.map(i => i.data));
const vi = ResEdit.Resource.VersionInfo.fromEntries(res.entries)[0];
if (vi) { const l = vi.getAvailableLanguages()[0]; vi.setStringValues(l, { ProductName: 'Braquet', FileDescription: 'Braquet', CompanyName: 'Braquet', LegalCopyright: 'Braquet', OriginalFilename: 'Braquet.exe', InternalName: 'Braquet' }); vi.outputToResourceEntries(res.entries); }
res.outputResource(exe); fs.writeFileSync(exePath, Buffer.from(exe.generate()));
console.log('ok', fs.statSync(exePath).size);
