import { registerRootComponent } from 'expo';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const API = 'https://finance.pm.sa/api/v1';
const today0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const n = (v) => Number(v || 0);
const money = (v) => `${n(v).toLocaleString('ar-SA')} ر.س`;
const fmtDate = (v) => v ? String(v).slice(0, 10) : '—';
const hdr = (t) => ({ Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${t}` });
const htmlEscape = (v) => String(v ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const isAli = (u) => String(u?.email || '').toLowerCase() === 'ali@pm.sa' || String(u?.account_slug || '').toLowerCase() === 'ali';
const statusLabel = (s) => s === 'active' ? 'نشط' : s === 'stuck' ? 'متعثر' : s === 'done' ? 'منتهي' : s === 'cancelled' ? 'ملغي' : String(s || '—');
const rows = (c) => Array.isArray(c.schedule) ? c.schedule : [];
const monthly = (c) => n(c.summary?.monthly_installment ?? c.monthly_installment);
const paid = (c) => n(c.summary?.paid_amount ?? c.paid_amount);
const remaining = (c) => n(c.summary?.remaining_amount ?? c.summary?.remaining_principal ?? c.remaining_amount);
const aliProfit = (c) => n(c.partner_profit_total ?? c.summary?.ali_total);
const isShared = (c) => c.profit_share === 'shared' || aliProfit(c) > 0 || n(c.summary?.ali_pct) > 0;
const isCourt = (c) => Boolean(c.has_court || c.court_note);

function stateOf(row) {
  if (row.is_paid || row.paid_at || row.status === 'paid') return { key: 'paid', label: 'مدفوع' };
  const due = String(row.due_date || '').slice(0, 10);
  if (due && new Date(due) < today0()) return { key: 'late', label: 'متأخر' };
  return { key: 'upcoming', label: 'قادم' };
}
function installmentAmount(row, client) { return n(row.remaining_due ?? row.amount ?? row.due_amount ?? monthly(client)); }
function scheduleStats(client) {
  const out = { paid: 0, late: 0, upcoming: 0, lateAmount: 0 };
  rows(client).forEach((row) => { const key = stateOf(row).key; out[key] += 1; if (key === 'late') out.lateAmount += installmentAmount(row, client); });
  if (!rows(client).length && client.status === 'stuck') { out.late = 1; out.lateAmount = monthly(client); }
  return out;
}
function paymentStats(client) {
  const all = rows(client);
  const paidRows = all.filter((r) => stateOf(r).key === 'paid');
  const unpaidRows = all.filter((r) => stateOf(r).key !== 'paid');
  const upcomingRows = all.filter((r) => stateOf(r).key === 'upcoming');
  const byDateDesc = (a, b) => String(b.paid_at || b.due_date || '').localeCompare(String(a.paid_at || a.due_date || ''));
  const byDueAsc = (a, b) => String(a.due_date || '').localeCompare(String(b.due_date || ''));
  const last = [...paidRows].sort(byDateDesc)[0];
  const next = [...upcomingRows].sort(byDueAsc)[0];
  return {
    paidCount: paidRows.length,
    unpaidCount: unpaidRows.length,
    totalPaid: paid(client),
    totalRemaining: remaining(client),
    lastPaidDate: last ? fmtDate(last.paid_at || last.due_date) : '—',
    lastPaidAmount: last ? money(installmentAmount(last, client)) : '—',
    nextDueDate: next ? fmtDate(next.due_date) : '—',
    nextDueAmount: next ? money(installmentAmount(next, client)) : '—',
  };
}
function lateInfo(client) { const st = scheduleStats(client); return { count: st.late, amount: st.lateAmount, rows: rows(client).filter((r) => stateOf(r).key === 'late') }; }
function buildReport(title, subtitle, source) {
  const items = source.map((c) => ({ c, i: lateInfo(c) })).filter((x) => x.i.count > 0).sort((a, b) => b.i.amount - a.i.amount);
  const ali = title.includes('علي');
  return { title, subtitle, items, ali, total: items.reduce((s, x) => s + x.i.amount, 0), aliTotal: items.reduce((s, x) => s + aliProfit(x.c), 0) };
}
function reportHtml(r) {
  const body = r.items.map((x, i) => `<tr><td>${i + 1}</td><td>${htmlEscape(x.c.name)}</td><td>${htmlEscape(x.c.phone || '—')}</td><td>${x.i.count}</td><td>${htmlEscape(money(x.i.amount))}</td><td>${htmlEscape(money(monthly(x.c)))}</td><td>${htmlEscape(money(remaining(x.c)))}</td><td>${htmlEscape(r.ali ? money(aliProfit(x.c)) : statusLabel(x.c.status))}</td></tr>`).join('');
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;padding:24px;direction:rtl;color:#111}h1{font-size:24px}.sub{color:#666}.grid{display:flex;gap:10px;margin:16px 0}.box{flex:1;background:#f3f3f3;border-radius:12px;padding:12px}.val{font-weight:800}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px;text-align:right;font-size:11px}th{background:#111;color:#fff}</style></head><body><h1>${htmlEscape(r.title)}</h1><div class="sub">${htmlEscape(r.subtitle)}</div><div class="grid"><div class="box"><div class="val">${r.items.length}</div><div>عدد المتأخرين</div></div><div class="box"><div class="val">${htmlEscape(money(r.total))}</div><div>إجمالي المتأخر</div></div><div class="box"><div class="val">${htmlEscape(r.ali ? money(r.aliTotal) : String(r.items.reduce((a, x) => a + x.i.count, 0)))}</div><div>${r.ali ? 'ربح علي' : 'الأقساط'}</div></div></div><table><thead><tr><th>#</th><th>العميل</th><th>الجوال</th><th>الأقساط</th><th>المتأخر</th><th>القسط</th><th>المتبقي</th><th>${r.ali ? 'ربح علي' : 'الحالة'}</th></tr></thead><tbody>${body || '<tr><td colspan="8">لا توجد سجلات</td></tr>'}</tbody></table></body></html>`;
}

function App() {
  const [token, setToken] = useState('');
  const [user, setUser] = useState(null);
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [clients, setClients] = useState([]);
  const [aliClients, setAliClients] = useState([]);
  const [busy, setBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState('');
  const [error, setError] = useState('');
  const [tab, setTab] = useState('dashboard');
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);

  async function signIn() {
    if (!login || !password) return Alert.alert('تنبيه', 'أدخل بيانات الدخول');
    try {
      setBusy(true); setError('');
      const res = await fetch(`${API}/auth/login`, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify({ login, email: login, password }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || 'تعذر تسجيل الدخول');
      const t = json.token || json.access_token || json.data?.token || json.data?.access_token;
      const u = json.user || json.data?.user || json.data || { email: login };
      if (!t) throw new Error('لم يتم العثور على رمز الدخول');
      setToken(t); setUser(u); await loadData(t, u); setTab('dashboard');
    } catch (e) { setError(e instanceof Error ? e.message : 'خطأ غير معروف'); }
    finally { setBusy(false); }
  }
  async function loadData(nextToken = token, nextUser = user) {
    const allRes = await fetch(`${API}/clients?status=all`, { headers: hdr(nextToken) });
    const allJson = await allRes.json().catch(() => ({}));
    if (!allRes.ok) throw new Error(allJson.message || 'تعذر تحميل العملاء');
    let shared = [];
    if (isAli(nextUser)) {
      const pRes = await fetch(`${API}/partner-clients`, { headers: hdr(nextToken) });
      const pJson = await pRes.json().catch(() => ({}));
      if (pRes.ok) shared = pJson.data ?? pJson;
    }
    setClients(Array.isArray(allJson.data ?? allJson) ? (allJson.data ?? allJson) : []);
    setAliClients(Array.isArray(shared) ? shared : []);
  }
  async function reload() { try { setBusy(true); await loadData(); } catch (e) { Alert.alert('تحديث البيانات', e instanceof Error ? e.message : 'تعذر التحديث'); } finally { setBusy(false); } }
  async function makePdf(report) {
    try {
      setPdfBusy(report.title);
      const Print = await import('expo-print');
      const Sharing = await import('expo-sharing');
      const file = await Print.printToFileAsync({ html: reportHtml(report), base64: false });
      if (Sharing.isAvailableAsync && await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', dialogTitle: report.title });
      else Alert.alert('تم إنشاء PDF', file.uri);
    } catch (e) { Alert.alert('PDF', e instanceof Error ? e.message : 'تعذر إنشاء PDF'); }
    finally { setPdfBusy(''); }
  }

  const sharedSource = isAli(user) ? aliClients : clients.filter(isShared);
  const reports = useMemo(() => [buildReport('تقرير المتأخرين', 'العملاء الذين لديهم أقساط متأخرة حاليًا بصفة عامة.', clients), buildReport('تقرير المتأخرين مع علي', 'التمويلات المتأخرة التي يشارك بها علي في الأرباح فقط.', sharedSource)], [clients, aliClients, user]);
  const stats = useMemo(() => { const late = clients.map(lateInfo).filter((x) => x.count > 0); return { total: clients.length, late: late.length, court: clients.filter(isCourt).length, shared: sharedSource.length, remaining: clients.reduce((s, c) => s + remaining(c), 0), monthly: clients.reduce((s, c) => s + monthly(c), 0), lateAmount: late.reduce((s, x) => s + x.amount, 0), aliProfit: sharedSource.reduce((s, c) => s + aliProfit(c), 0) }; }, [clients, sharedSource]);
  const visible = useMemo(() => clients.filter((c) => { const q = query.trim().toLowerCase(); if (q && !String(c.name || '').toLowerCase().includes(q) && !String(c.phone || '').includes(q)) return false; if (filter === 'late') return lateInfo(c).count > 0; if (filter === 'court') return isCourt(c); if (filter === 'shared') return isShared(c); return true; }), [clients, filter, query]);

  if (!token) return <View style={s.safe}><StatusBar barStyle="dark-content" /><ScrollView contentContainerStyle={s.loginWrap}><View style={s.hero}><Text style={s.heroTitle}>إدارة التمويل</Text><Text style={s.heroSub}>نسخة APK مستقلة بدون Expo Router</Text></View><View style={s.card}><Text style={s.title}>تسجيل الدخول</Text><TextInput style={s.input} value={login} onChangeText={setLogin} placeholder="admin@pm.sa" autoCapitalize="none" textAlign="right"/><TextInput style={s.input} value={password} onChangeText={setPassword} placeholder="كلمة المرور" secureTextEntry textAlign="right"/><TouchableOpacity style={s.btn} onPress={signIn} disabled={busy}>{busy ? <ActivityIndicator color="#fff"/> : <Text style={s.btnText}>دخول</Text>}</TouchableOpacity>{error ? <Text style={s.errText}>{error}</Text> : null}</View></ScrollView></View>;
  return <View style={s.safe}><StatusBar barStyle="dark-content" /><ScrollView contentContainerStyle={s.wrap}><Header user={user} busy={busy} reload={reload} logout={() => { setToken(''); setUser(null); setClients([]); setAliClients([]); setSelected(null); }} />{selected ? <ClientDetails client={selected} onBack={() => setSelected(null)} /> : <><Tabs tab={tab} setTab={setTab} />{tab === 'dashboard' ? <Dashboard stats={stats} reports={reports} setTab={setTab} /> : null}{tab === 'clients' ? <ClientsView clients={visible} filter={filter} setFilter={setFilter} query={query} setQuery={setQuery} onSelect={setSelected} /> : null}{tab === 'reports' ? <ReportsView reports={reports} makePdf={makePdf} pdfBusy={pdfBusy} /> : null}</>}</ScrollView></View>;
}
function Header({ user, busy, reload, logout }) { return <View style={s.row}><View style={s.actions}><TouchableOpacity style={s.out} onPress={logout}><Text style={s.outText}>خروج</Text></TouchableOpacity><TouchableOpacity style={s.refresh} onPress={reload} disabled={busy}><Text style={s.refreshText}>{busy ? '...' : 'تحديث'}</Text></TouchableOpacity></View><View style={{ flex: 1 }}><Text style={s.page}>إدارة التمويل</Text><Text style={s.mutedRight}>{user?.name || user?.email || 'مستخدم النظام'}</Text></View></View>; }
function Tabs({ tab, setTab }) { return <View style={s.tabs}>{[['dashboard','اللوحة'],['clients','العملاء'],['reports','التقارير']].map(([k,l]) => <TouchableOpacity key={k} style={[s.tab, tab === k && s.tabOn]} onPress={() => setTab(k)}><Text style={[s.tabText, tab === k && s.tabTextOn]}>{l}</Text></TouchableOpacity>)}</View>; }
function Dashboard({ stats, reports, setTab }) { return <><View style={s.grid}><Box v={String(stats.total)} l="العملاء"/><Box v={String(stats.late)} l="متأخرين"/><Box v={money(stats.lateAmount)} l="إجمالي المتأخر"/></View><View style={s.grid}><Box v={String(stats.court)} l="قضايا"/><Box v={String(stats.shared)} l="مع علي"/><Box v={money(stats.aliProfit)} l="ربح علي"/></View><View style={s.card}><Text style={s.title}>مختصر المحفظة</Text><Text style={s.mutedRight}>المتبقي: {money(stats.remaining)}</Text><Text style={s.mutedRight}>التحصيل الشهري: {money(stats.monthly)}</Text><TouchableOpacity style={s.btnLite} onPress={() => setTab('reports')}><Text style={s.btnLiteText}>فتح التقارير</Text></TouchableOpacity></View><View style={s.card}><Text style={s.title}>تقرير المتأخرين مع علي</Text><Text style={s.mutedRight}>{reports[1].items.length} سجل · {money(reports[1].total)}</Text></View></>; }
function ClientsView({ clients, filter, setFilter, query, setQuery, onSelect }) { return <><View style={s.card}><Text style={s.title}>العملاء</Text><TextInput style={s.input} value={query} onChangeText={setQuery} placeholder="بحث باسم العميل أو الجوال" textAlign="right"/><View style={s.chips}>{[['all','الكل'],['late','متأخر'],['court','قضايا'],['shared','مع علي']].map(([k,l]) => <TouchableOpacity key={k} style={[s.chip, filter === k && s.chipOn]} onPress={() => setFilter(k)}><Text style={[s.chipText, filter === k && s.chipTextOn]}>{l}</Text></TouchableOpacity>)}</View></View>{clients.map((c) => <ClientCard key={String(c.id)} c={c} onPress={() => onSelect(c)} />)}{!clients.length ? <Text style={s.empty}>لا توجد نتائج</Text> : null}</>; }
function ClientCard({ c, onPress }) { const late = lateInfo(c); return <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={s.client}><View style={s.row}><Text style={[s.badge, late.count ? s.badgeDanger : isCourt(c) ? s.badgeCourt : s.badgeOk]}>{late.count ? 'متأخر' : isCourt(c) ? 'قضية' : statusLabel(c.status)}</Text><View style={{ flex: 1 }}><Text style={s.clientName}>{c.name || '—'}</Text><Text style={s.mutedRight}>{c.phone || 'بدون جوال'}</Text></View></View><View style={s.grid}><Box v={money(monthly(c))} l="القسط"/><Box v={money(remaining(c))} l="المتبقي"/><Box v={late.count ? money(late.amount) : money(aliProfit(c))} l={late.count ? 'المتأخر' : 'ربح علي'} /></View><Text style={s.tapHint}>اضغط لعرض التفاصيل</Text></TouchableOpacity>; }
function ClientDetails({ client, onBack }) { const late = lateInfo(client); const all = rows(client); const st = scheduleStats(client); const pay = paymentStats(client); return <><View style={s.detailsHeader}><TouchableOpacity style={s.backBtn} onPress={onBack}><Text style={s.backText}>رجوع</Text></TouchableOpacity><View style={{ flex: 1 }}><Text style={s.page}>{client.name || 'تفاصيل العميل'}</Text><Text style={s.mutedRight}>عرض فقط بدون تعديل</Text></View></View><View style={s.card}><Text style={s.title}>بيانات العميل</Text><Info label="الاسم" value={client.name || '—'} /><Info label="الجوال" value={client.phone || '—'} /><Info label="الحالة" value={isCourt(client) ? 'قضية' : statusLabel(client.status)} /><Info label="تاريخ العقد" value={fmtDate(client.contract_date || client.created_at)} />{client.court_note ? <Info label="ملاحظة القضية" value={client.court_note} /> : null}</View><View style={s.grid}><Box v={money(monthly(client))} l="القسط الشهري"/><Box v={money(paid(client))} l="المدفوع"/><Box v={money(remaining(client))} l="المتبقي"/></View><View style={s.grid}><Box v={String(late.count)} l="متأخرة"/><Box v={String(st.paid)} l="مدفوعة"/><Box v={String(st.upcoming)} l="قادمة"/></View><View style={s.card}><Text style={s.title}>المدفوعات والتحصيل</Text><View style={s.grid}><Box v={money(pay.totalPaid)} l="إجمالي المدفوع"/><Box v={money(pay.totalRemaining)} l="إجمالي المتبقي"/><Box v={String(pay.unpaidCount)} l="غير مدفوعة"/></View><Info label="آخر دفعة" value={`${pay.lastPaidAmount} · ${pay.lastPaidDate}`} /><Info label="أقرب استحقاق قادم" value={`${pay.nextDueAmount} · ${pay.nextDueDate}`} /><Info label="الأقساط المدفوعة" value={String(pay.paidCount)} /></View><View style={s.grid}><Box v={money(late.amount)} l="المتأخر"/><Box v={money(aliProfit(client))} l="ربح علي"/><Box v={String(client.months || client.summary?.total_installments || all.length || '—')} l="الأقساط"/></View><View style={s.card}><Text style={s.title}>معلومات إضافية</Text><Info label="مشاركة الأرباح" value={isShared(client) ? 'يوجد مشاركة' : 'لا يوجد'} /><Info label="نسبة علي" value={client.summary?.ali_pct ? `${client.summary.ali_pct}%` : '—'} /></View><View style={s.card}><Text style={s.title}>جدول الأقساط الكامل</Text>{all.length ? all.map((row, i) => <InstallmentRow key={String(row.id || i)} row={row} client={client} index={i} />) : <Text style={s.empty}>لا يوجد جدول أقساط مسجل</Text>}</View></>; }
function InstallmentRow({ row, client, index }) { const st = stateOf(row); return <View style={s.scheduleRow}><Text style={[s.scheduleBadge, st.key === 'paid' ? s.paidBadge : st.key === 'late' ? s.lateBadge : s.upcomingBadge]}>{st.label}</Text><View style={{ flex: 1 }}><Text style={s.scheduleTitle}>قسط رقم {n(row.installment_no ?? row.number ?? index + 1)}</Text><Text style={s.mutedRight}>{fmtDate(row.due_date)}</Text></View><Text style={s.scheduleAmount}>{money(installmentAmount(row, client))}</Text></View>; }
function Info({ label, value }) { return <View style={s.infoRow}><Text style={s.infoValue}>{String(value ?? '—')}</Text><Text style={s.infoLabel}>{label}</Text></View>; }
function ReportsView({ reports, makePdf, pdfBusy }) { return <>{reports.map((r) => <View key={r.title} style={s.card}><Text style={s.title}>{r.title}</Text><Text style={s.mutedRight}>{r.subtitle}</Text><View style={s.summary}><Box v={String(r.items.length)} l="عدد المتأخرين"/><Box v={money(r.total)} l="إجمالي المتأخر"/><Box v={r.ali ? money(r.aliTotal) : String(r.items.reduce((a, x) => a + x.i.count, 0))} l={r.ali ? 'ربح علي' : 'الأقساط'} /></View><View style={s.row}><Text style={s.mutedRight}>{r.items.length} سجل</Text><TouchableOpacity style={s.pdf} onPress={() => makePdf(r)} disabled={Boolean(pdfBusy)}>{pdfBusy === r.title ? <ActivityIndicator color="#fff"/> : <Text style={s.pdfText}>PDF</Text>}</TouchableOpacity></View></View>)}</>; }
function Box({ v, l }) { return <View style={s.box}><Text style={s.boxVal} numberOfLines={1}>{v}</Text><Text style={s.boxLab} numberOfLines={1}>{l}</Text></View>; }
const s = StyleSheet.create({ safe:{flex:1,backgroundColor:'#f5f5f3',paddingTop:28}, loginWrap:{flexGrow:1,justifyContent:'center',padding:16,gap:14}, wrap:{padding:16,paddingBottom:40,gap:14}, hero:{backgroundColor:'#111',borderRadius:26,padding:20,gap:8}, heroTitle:{color:'#fff',fontSize:28,fontWeight:'900',textAlign:'right'}, heroSub:{color:'#ddd',fontSize:14,textAlign:'right'}, card:{backgroundColor:'#fff',borderRadius:22,padding:16,gap:12,borderWidth:1,borderColor:'#e8e6df'}, title:{fontSize:18,fontWeight:'900',color:'#111',textAlign:'right'}, input:{minHeight:50,borderWidth:1,borderColor:'#e8e6df',borderRadius:16,backgroundColor:'#f5f5f3',paddingHorizontal:12}, btn:{minHeight:52,borderRadius:18,backgroundColor:'#111',alignItems:'center',justifyContent:'center'}, btnText:{color:'#fff',fontWeight:'900',fontSize:16}, row:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12}, actions:{flexDirection:'row',gap:8}, page:{fontSize:28,fontWeight:'900',color:'#111',textAlign:'right'}, mutedRight:{color:'#666',fontSize:13,lineHeight:20,textAlign:'right'}, out:{backgroundColor:'#fff',borderRadius:14,paddingHorizontal:14,paddingVertical:10,borderWidth:1,borderColor:'#e8e6df'}, outText:{color:'#a32d2d',fontWeight:'900'}, refresh:{backgroundColor:'#111',borderRadius:14,paddingHorizontal:14,paddingVertical:10}, refreshText:{color:'#fff',fontWeight:'900'}, tabs:{flexDirection:'row-reverse',gap:8,backgroundColor:'#fff',borderRadius:18,padding:6,borderWidth:1,borderColor:'#e8e6df'}, tab:{flex:1,paddingVertical:11,borderRadius:14,alignItems:'center'}, tabOn:{backgroundColor:'#111'}, tabText:{fontWeight:'900',color:'#666'}, tabTextOn:{color:'#fff'}, grid:{flexDirection:'row-reverse',gap:8}, summary:{flexDirection:'row-reverse',gap:8}, box:{flex:1,backgroundColor:'#f5f5f3',borderRadius:14,padding:9}, boxVal:{fontSize:12,fontWeight:'900',textAlign:'right',color:'#111'}, boxLab:{fontSize:10,color:'#666',textAlign:'right'}, pdf:{backgroundColor:'#a32d2d',borderRadius:14,paddingHorizontal:18,paddingVertical:10,minWidth:70,alignItems:'center'}, pdfText:{color:'#fff',fontWeight:'900'}, errText:{color:'#a32d2d',textAlign:'right',fontWeight:'800'}, btnLite:{backgroundColor:'#f5f5f3',borderRadius:14,padding:12,alignItems:'center'}, btnLiteText:{fontWeight:'900',color:'#111'}, chips:{flexDirection:'row-reverse',flexWrap:'wrap',gap:8}, chip:{paddingHorizontal:12,paddingVertical:9,borderRadius:14,backgroundColor:'#f5f5f3',borderWidth:1,borderColor:'#e8e6df'}, chipOn:{backgroundColor:'#111'}, chipText:{fontWeight:'900',color:'#666'}, chipTextOn:{color:'#fff'}, client:{backgroundColor:'#fff',borderRadius:20,padding:14,gap:10,borderWidth:1,borderColor:'#e8e6df'}, clientName:{fontSize:16,fontWeight:'900',color:'#111',textAlign:'right'}, badge:{paddingHorizontal:10,paddingVertical:6,borderRadius:999,overflow:'hidden',fontSize:11,fontWeight:'900'}, badgeDanger:{backgroundColor:'#fcebeb',color:'#a32d2d'}, badgeCourt:{backgroundColor:'#eeedfe',color:'#534ab7'}, badgeOk:{backgroundColor:'#eaf3de',color:'#1d9e75'}, empty:{textAlign:'center',color:'#666',fontWeight:'800',padding:20}, tapHint:{fontSize:11,color:'#999',textAlign:'center',fontWeight:'800'}, detailsHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12}, backBtn:{backgroundColor:'#111',borderRadius:14,paddingHorizontal:16,paddingVertical:11}, backText:{color:'#fff',fontWeight:'900'}, infoRow:{flexDirection:'row',justifyContent:'space-between',gap:12,borderBottomWidth:1,borderBottomColor:'#f1efe8',paddingBottom:8}, infoLabel:{color:'#666',fontWeight:'800',textAlign:'right'}, infoValue:{flex:1,color:'#111',fontWeight:'900',textAlign:'left'}, scheduleRow:{flexDirection:'row',alignItems:'center',gap:10,backgroundColor:'#f5f5f3',borderRadius:14,padding:10}, scheduleTitle:{fontWeight:'900',color:'#111',textAlign:'right'}, scheduleAmount:{fontWeight:'900',color:'#111'}, scheduleBadge:{paddingHorizontal:9,paddingVertical:5,borderRadius:999,overflow:'hidden',fontSize:11,fontWeight:'900'}, paidBadge:{backgroundColor:'#eaf3de',color:'#1d9e75'}, lateBadge:{backgroundColor:'#fcebeb',color:'#a32d2d'}, upcomingBadge:{backgroundColor:'#e6f1fb',color:'#185fa5'} });
registerRootComponent(App);
