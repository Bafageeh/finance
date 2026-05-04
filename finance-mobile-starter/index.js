import { registerRootComponent } from 'expo';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const API = 'https://finance.pm.sa/api/v1';

function money(n) { return `${Number(n || 0).toLocaleString('ar-SA')} ر.س`; }
function escapeHtml(v) { return String(v ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch])); }
function statusLabel(s) { return s === 'active' ? 'نشط' : s === 'stuck' ? 'متعثر' : s === 'done' ? 'منتهي' : String(s || '—'); }
function isAli(user) { return String(user?.email || '').toLowerCase() === 'ali@pm.sa' || String(user?.account_slug || '').toLowerCase() === 'ali'; }
function tokenHeaders(token) { return { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }; }
function n(v) { return Number(v || 0); }
function remaining(c) { return n(c.summary?.remaining_amount ?? c.summary?.remaining_principal ?? c.remaining_amount); }
function monthly(c) { return n(c.summary?.monthly_installment ?? c.monthly_installment); }
function paid(c) { return n(c.summary?.paid_amount ?? c.paid_amount); }
function aliProfit(c) { return n(c.partner_profit_total ?? c.summary?.ali_total); }
function isShared(c) { return c.profit_share === 'shared' || aliProfit(c) > 0 || n(c.summary?.ali_pct) > 0; }
function isCourt(c) { return Boolean(c.has_court || c.court_note); }
function lateInfo(client) {
  const today = new Date(); today.setHours(0,0,0,0);
  const rows = Array.isArray(client.schedule) ? client.schedule : [];
  const late = rows.filter(x => !x.is_paid && String(x.due_date || '') && new Date(String(x.due_date).slice(0,10)) < today);
  const fallback = client.status === 'stuck' ? 1 : 0;
  const count = late.length || fallback;
  const amount = late.reduce((s, x) => s + n(x.remaining_due ?? x.amount ?? monthly(client)), 0) || (fallback ? monthly(client) : 0);
  return { count, amount };
}
function buildReport(title, subtitle, source) {
  const items = source.map(c => ({ c, i: lateInfo(c) })).filter(x => x.i.count > 0).sort((a,b) => b.i.amount - a.i.amount);
  const ali = title.includes('علي');
  return { title, subtitle, items, total: items.reduce((s,x) => s + x.i.amount, 0), aliTotal: items.reduce((s,x) => s + aliProfit(x.c), 0), ali };
}
function reportHtml(report) {
  const rows = report.items.map((x, idx) => `<tr><td>${idx + 1}</td><td>${escapeHtml(x.c.name)}</td><td>${escapeHtml(x.c.phone || '—')}</td><td>${x.i.count}</td><td>${escapeHtml(money(x.i.amount))}</td><td>${escapeHtml(money(monthly(x.c)))}</td><td>${escapeHtml(money(remaining(x.c)))}</td><td>${escapeHtml(report.ali ? money(aliProfit(x.c)) : statusLabel(x.c.status))}</td></tr>`).join('');
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;padding:24px;direction:rtl;color:#111}h1{font-size:24px;margin:0 0 8px}.sub{color:#666;margin-bottom:18px}.grid{display:flex;gap:10px;margin:16px 0}.box{flex:1;background:#f3f3f3;border-radius:12px;padding:12px}.val{font-weight:800;font-size:16px}.lab{color:#666;font-size:12px}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border:1px solid #ddd;padding:8px;text-align:right;font-size:11px}th{background:#111;color:#fff}</style></head><body><h1>${escapeHtml(report.title)}</h1><div class="sub">${escapeHtml(report.subtitle)}</div><div class="grid"><div class="box"><div class="val">${report.items.length}</div><div class="lab">عدد المتأخرين</div></div><div class="box"><div class="val">${escapeHtml(money(report.total))}</div><div class="lab">إجمالي المتأخر</div></div><div class="box"><div class="val">${escapeHtml(report.ali ? money(report.aliTotal) : String(report.items.reduce((a,x)=>a+x.i.count,0)))}</div><div class="lab">${report.ali ? 'ربح علي' : 'الأقساط'}</div></div></div><table><thead><tr><th>#</th><th>العميل</th><th>الجوال</th><th>الأقساط</th><th>المبلغ المتأخر</th><th>القسط الشهري</th><th>المتبقي</th><th>${report.ali ? 'ربح علي' : 'الحالة'}</th></tr></thead><tbody>${rows || '<tr><td colspan="8">لا توجد سجلات</td></tr>'}</tbody></table></body></html>`;
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
  const aliAccount = isAli(user);

  async function signIn() {
    if (!login || !password) return Alert.alert('تنبيه', 'أدخل بيانات الدخول');
    try {
      setBusy(true); setError('');
      const res = await fetch(`${API}/auth/login`, { method: 'POST', headers: { Accept:'application/json','Content-Type':'application/json' }, body: JSON.stringify({ login, email: login, password }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || 'تعذر تسجيل الدخول');
      const t = json.token || json.access_token || json.data?.token || json.data?.access_token;
      const u = json.user || json.data?.user || json.data || { email: login };
      if (!t) throw new Error('لم يتم العثور على رمز الدخول');
      setToken(t); setUser(u); await loadData(t, u); setTab('dashboard');
    } catch(e) { setError(e instanceof Error ? e.message : 'خطأ غير معروف'); }
    finally { setBusy(false); }
  }
  async function loadData(nextToken = token, nextUser = user) {
    const headers = tokenHeaders(nextToken);
    const allRes = await fetch(`${API}/clients?status=all`, { headers });
    const allJson = await allRes.json().catch(() => ({}));
    if (!allRes.ok) throw new Error(allJson.message || 'تعذر تحميل العملاء');
    const all = allJson.data ?? allJson;
    let shared = [];
    if (isAli(nextUser)) {
      const pRes = await fetch(`${API}/partner-clients`, { headers });
      const pJson = await pRes.json().catch(() => ({}));
      if (pRes.ok) shared = pJson.data ?? pJson;
    }
    setClients(Array.isArray(all) ? all : []); setAliClients(Array.isArray(shared) ? shared : []);
  }
  async function reload() {
    try { setBusy(true); await loadData(); }
    catch(e) { Alert.alert('تحديث البيانات', e instanceof Error ? e.message : 'تعذر التحديث'); }
    finally { setBusy(false); }
  }
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

  const sharedSource = aliAccount ? aliClients : clients.filter(c => isShared(c));
  const reports = useMemo(() => [
    buildReport('تقرير المتأخرين', 'العملاء الذين لديهم أقساط متأخرة حاليًا بصفة عامة.', clients),
    buildReport('تقرير المتأخرين مع علي', 'التمويلات المتأخرة التي يشارك بها علي في الأرباح فقط.', sharedSource),
  ], [clients, aliClients, user]);
  const stats = useMemo(() => {
    const late = clients.map(c => lateInfo(c)).filter(x => x.count > 0);
    return { total: clients.length, late: late.length, court: clients.filter(isCourt).length, shared: sharedSource.length, remaining: clients.reduce((s,c)=>s+remaining(c),0), monthly: clients.reduce((s,c)=>s+monthly(c),0), lateAmount: late.reduce((s,x)=>s+x.amount,0), aliProfit: sharedSource.reduce((s,c)=>s+aliProfit(c),0) };
  }, [clients, sharedSource]);
  const visibleClients = useMemo(() => clients.filter(c => {
    const q = query.trim().toLowerCase();
    const matches = !q || String(c.name || '').toLowerCase().includes(q) || String(c.phone || '').includes(q);
    if (!matches) return false;
    if (filter === 'late') return lateInfo(c).count > 0;
    if (filter === 'court') return isCourt(c);
    if (filter === 'shared') return isShared(c);
    return true;
  }), [clients, filter, query]);

  if (!token) return <View style={s.safe}><StatusBar barStyle="dark-content" /><ScrollView contentContainerStyle={s.loginWrap}><View style={s.hero}><Text style={s.heroTitle}>إدارة التمويل</Text><Text style={s.heroSub}>نسخة APK مستقلة بدون Expo Router</Text></View><View style={s.card}><Text style={s.title}>تسجيل الدخول</Text><TextInput style={s.input} value={login} onChangeText={setLogin} placeholder="admin@pm.sa" autoCapitalize="none" textAlign="right"/><TextInput style={s.input} value={password} onChangeText={setPassword} placeholder="كلمة المرور" secureTextEntry textAlign="right"/><TouchableOpacity style={s.btn} onPress={signIn} disabled={busy}>{busy ? <ActivityIndicator color="#fff"/> : <Text style={s.btnText}>دخول</Text>}</TouchableOpacity>{error ? <Text style={s.errText}>{error}</Text> : null}</View></ScrollView></View>;

  return <View style={s.safe}><StatusBar barStyle="dark-content" /><ScrollView contentContainerStyle={s.wrap}><Header user={user} busy={busy} reload={reload} logout={() => { setToken(''); setUser(null); setClients([]); setAliClients([]); }} /><View style={s.tabs}>{['dashboard','clients','reports'].map(x => <TouchableOpacity key={x} style={[s.tab, tab === x && s.tabOn]} onPress={() => setTab(x)}><Text style={[s.tabText, tab === x && s.tabTextOn]}>{x === 'dashboard' ? 'اللوحة' : x === 'clients' ? 'العملاء' : 'التقارير'}</Text></TouchableOpacity>)}</View>{tab === 'dashboard' ? <Dashboard stats={stats} reports={reports} setTab={setTab} /> : null}{tab === 'clients' ? <ClientsView clients={visibleClients} filter={filter} setFilter={setFilter} query={query} setQuery={setQuery} /> : null}{tab === 'reports' ? <ReportsView reports={reports} makePdf={makePdf} pdfBusy={pdfBusy} /> : null}</ScrollView></View>;
}
function Header({user,busy,reload,logout}) { return <View style={s.row}><View style={s.actions}><TouchableOpacity style={s.out} onPress={logout}><Text style={s.outText}>خروج</Text></TouchableOpacity><TouchableOpacity style={s.refresh} onPress={reload} disabled={busy}><Text style={s.refreshText}>{busy ? '...' : 'تحديث'}</Text></TouchableOpacity></View><View style={{flex:1}}><Text style={s.page}>إدارة التمويل</Text><Text style={s.mutedRight}>{user?.name || user?.email || 'مستخدم النظام'}</Text></View></View>; }
function Dashboard({stats,reports,setTab}) { return <><View style={s.grid}><Box v={String(stats.total)} l="العملاء"/><Box v={String(stats.late)} l="متأخرين"/><Box v={money(stats.lateAmount)} l="إجمالي المتأخر"/></View><View style={s.grid}><Box v={String(stats.court)} l="قضايا"/><Box v={String(stats.shared)} l="مع علي"/><Box v={money(stats.aliProfit)} l="ربح علي"/></View><View style={s.card}><Text style={s.title}>مختصر المحفظة</Text><Text style={s.mutedRight}>المتبقي: {money(stats.remaining)}</Text><Text style={s.mutedRight}>التحصيل الشهري: {money(stats.monthly)}</Text><TouchableOpacity style={s.btnLite} onPress={() => setTab('reports')}><Text style={s.btnLiteText}>فتح التقارير</Text></TouchableOpacity></View><View style={s.card}><Text style={s.title}>تقرير المتأخرين مع علي</Text><Text style={s.mutedRight}>{reports[1].items.length} سجل · {money(reports[1].total)}</Text></View></>; }
function ClientsView({clients,filter,setFilter,query,setQuery}) { return <><View style={s.card}><Text style={s.title}>العملاء</Text><TextInput style={s.input} value={query} onChangeText={setQuery} placeholder="بحث باسم العميل أو الجوال" textAlign="right"/><View style={s.chips}>{[['all','الكل'],['late','متأخر'],['court','قضايا'],['shared','مع علي']].map(([k,l]) => <TouchableOpacity key={k} style={[s.chip, filter === k && s.chipOn]} onPress={() => setFilter(k)}><Text style={[s.chipText, filter === k && s.chipTextOn]}>{l}</Text></TouchableOpacity>)}</View></View>{clients.map(c => <ClientCard key={String(c.id)} c={c} />)}{!clients.length ? <Text style={s.empty}>لا توجد نتائج</Text> : null}</>; }
function ClientCard({c}) { const late = lateInfo(c); return <View style={s.client}><View style={s.row}><Text style={[s.badge, late.count ? s.badgeDanger : isCourt(c) ? s.badgeCourt : s.badgeOk]}>{late.count ? 'متأخر' : isCourt(c) ? 'قضية' : statusLabel(c.status)}</Text><View style={{flex:1}}><Text style={s.clientName}>{c.name || '—'}</Text><Text style={s.mutedRight}>{c.phone || 'بدون جوال'}</Text></View></View><View style={s.grid}><Box v={money(monthly(c))} l="القسط"/><Box v={money(remaining(c))} l="المتبقي"/><Box v={late.count ? money(late.amount) : money(aliProfit(c))} l={late.count ? 'المتأخر' : 'ربح علي'} /></View></View>; }
function ReportsView({reports,makePdf,pdfBusy}) { return <>{reports.map(r => <View key={r.title} style={s.card}><Text style={s.title}>{r.title}</Text><Text style={s.mutedRight}>{r.subtitle}</Text><View style={s.summary}><Box v={String(r.items.length)} l="عدد المتأخرين"/><Box v={money(r.total)} l="إجمالي المتأخر"/><Box v={r.ali ? money(r.aliTotal) : String(r.items.reduce((a,x)=>a+x.i.count,0))} l={r.ali ? 'ربح علي' : 'الأقساط'} /></View><View style={s.row}><Text style={s.mutedRight}>{r.items.length} سجل</Text><TouchableOpacity style={s.pdf} onPress={() => makePdf(r)} disabled={Boolean(pdfBusy)}>{pdfBusy === r.title ? <ActivityIndicator color="#fff"/> : <Text style={s.pdfText}>PDF</Text>}</TouchableOpacity></View></View>)}</>; }
function Box({v,l}) { return <View style={s.box}><Text style={s.boxVal} numberOfLines={1}>{v}</Text><Text style={s.boxLab} numberOfLines={1}>{l}</Text></View>; }
const s = StyleSheet.create({ safe:{flex:1,backgroundColor:'#f5f5f3',paddingTop:28}, loginWrap:{flexGrow:1,justifyContent:'center',padding:16,gap:14}, wrap:{padding:16,paddingBottom:40,gap:14}, hero:{backgroundColor:'#111',borderRadius:26,padding:20,gap:8}, heroTitle:{color:'#fff',fontSize:28,fontWeight:'900',textAlign:'right'}, heroSub:{color:'#ddd',fontSize:14,textAlign:'right'}, card:{backgroundColor:'#fff',borderRadius:22,padding:16,gap:12,borderWidth:1,borderColor:'#e8e6df'}, title:{fontSize:18,fontWeight:'900',color:'#111',textAlign:'right'}, input:{minHeight:50,borderWidth:1,borderColor:'#e8e6df',borderRadius:16,backgroundColor:'#f5f5f3',paddingHorizontal:12}, btn:{minHeight:52,borderRadius:18,backgroundColor:'#111',alignItems:'center',justifyContent:'center'}, btnText:{color:'#fff',fontWeight:'900',fontSize:16}, row:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12}, actions:{flexDirection:'row',gap:8}, page:{fontSize:28,fontWeight:'900',color:'#111',textAlign:'right'}, mutedRight:{color:'#666',fontSize:13,lineHeight:20,textAlign:'right'}, out:{backgroundColor:'#fff',borderRadius:14,paddingHorizontal:14,paddingVertical:10,borderWidth:1,borderColor:'#e8e6df'}, outText:{color:'#a32d2d',fontWeight:'900'}, refresh:{backgroundColor:'#111',borderRadius:14,paddingHorizontal:14,paddingVertical:10}, refreshText:{color:'#fff',fontWeight:'900'}, tabs:{flexDirection:'row-reverse',gap:8,backgroundColor:'#fff',borderRadius:18,padding:6,borderWidth:1,borderColor:'#e8e6df'}, tab:{flex:1,paddingVertical:11,borderRadius:14,alignItems:'center'}, tabOn:{backgroundColor:'#111'}, tabText:{fontWeight:'900',color:'#666'}, tabTextOn:{color:'#fff'}, grid:{flexDirection:'row-reverse',gap:8}, summary:{flexDirection:'row-reverse',gap:8}, box:{flex:1,backgroundColor:'#f5f5f3',borderRadius:14,padding:9}, boxVal:{fontSize:12,fontWeight:'900',textAlign:'right',color:'#111'}, boxLab:{fontSize:10,color:'#666',textAlign:'right'}, pdf:{backgroundColor:'#a32d2d',borderRadius:14,paddingHorizontal:18,paddingVertical:10,minWidth:70,alignItems:'center'}, pdfText:{color:'#fff',fontWeight:'900'}, errText:{color:'#a32d2d',textAlign:'right',fontWeight:'800'}, btnLite:{backgroundColor:'#f5f5f3',borderRadius:14,padding:12,alignItems:'center'}, btnLiteText:{fontWeight:'900',color:'#111'}, chips:{flexDirection:'row-reverse',flexWrap:'wrap',gap:8}, chip:{paddingHorizontal:12,paddingVertical:9,borderRadius:14,backgroundColor:'#f5f5f3',borderWidth:1,borderColor:'#e8e6df'}, chipOn:{backgroundColor:'#111'}, chipText:{fontWeight:'900',color:'#666'}, chipTextOn:{color:'#fff'}, client:{backgroundColor:'#fff',borderRadius:20,padding:14,gap:10,borderWidth:1,borderColor:'#e8e6df'}, clientName:{fontSize:16,fontWeight:'900',color:'#111',textAlign:'right'}, badge:{paddingHorizontal:10,paddingVertical:6,borderRadius:999,overflow:'hidden',fontSize:11,fontWeight:'900'}, badgeDanger:{backgroundColor:'#fcebeb',color:'#a32d2d'}, badgeCourt:{backgroundColor:'#eeedfe',color:'#534ab7'}, badgeOk:{backgroundColor:'#eaf3de',color:'#1d9e75'}, empty:{textAlign:'center',color:'#666',fontWeight:'800',padding:20} });
registerRootComponent(App);
