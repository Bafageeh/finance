import { registerRootComponent } from 'expo';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const API = 'https://finance.pm.sa/api/v1';

function money(n) { return `${Number(n || 0).toLocaleString('ar-SA')} ر.س`; }
function escapeHtml(v) { return String(v ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch])); }
function statusLabel(s) { return s === 'active' ? 'نشط' : s === 'stuck' ? 'متعثر' : s === 'done' ? 'منتهي' : String(s || '—'); }
function isAli(user) { return String(user?.email || '').toLowerCase() === 'ali@pm.sa' || String(user?.account_slug || '').toLowerCase() === 'ali'; }
function tokenHeaders(token) { return { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }; }
function lateInfo(client) {
  const today = new Date(); today.setHours(0,0,0,0);
  const rows = Array.isArray(client.schedule) ? client.schedule : [];
  const late = rows.filter(x => !x.is_paid && String(x.due_date || '') && new Date(String(x.due_date).slice(0,10)) < today);
  const fallback = client.status === 'stuck' ? 1 : 0;
  const count = late.length || fallback;
  const amount = late.reduce((s, x) => s + Number(x.remaining_due ?? x.amount ?? client.summary?.monthly_installment ?? 0), 0) || (fallback ? Number(client.summary?.monthly_installment || 0) : 0);
  return { count, amount };
}
function buildReport(title, subtitle, source) {
  const items = source.map(c => ({ c, i: lateInfo(c) })).filter(x => x.i.count > 0).sort((a,b) => b.i.amount - a.i.amount);
  const ali = title.includes('علي');
  return { title, subtitle, items, total: items.reduce((s,x) => s + x.i.amount, 0), aliTotal: items.reduce((s,x) => s + Number(x.c.partner_profit_total ?? x.c.summary?.ali_total ?? 0), 0), ali };
}
function reportHtml(report) {
  const rows = report.items.map((x, idx) => `<tr><td>${idx + 1}</td><td>${escapeHtml(x.c.name)}</td><td>${escapeHtml(x.c.phone || '—')}</td><td>${x.i.count}</td><td>${escapeHtml(money(x.i.amount))}</td><td>${escapeHtml(money(x.c.summary?.monthly_installment || 0))}</td><td>${escapeHtml(money(x.c.summary?.remaining_amount || 0))}</td><td>${escapeHtml(report.ali ? money(x.c.partner_profit_total ?? x.c.summary?.ali_total ?? 0) : statusLabel(x.c.status))}</td></tr>`).join('');
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
      setToken(t); setUser(u); await loadData(t, u);
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
  const reports = useMemo(() => [buildReport('تقرير المتأخرين', 'العملاء الذين لديهم أقساط متأخرة حاليًا بصفة عامة.', clients), buildReport('تقرير المتأخرين مع علي', 'التمويلات المتأخرة التي يشارك بها علي في الأرباح فقط.', isAli(user) ? aliClients : clients.filter(c => c.profit_share === 'shared' || Number(c.summary?.ali_total || 0) > 0))], [clients, aliClients, user]);
  if (!token) return <View style={s.safe}><StatusBar barStyle="dark-content" /><ScrollView contentContainerStyle={s.loginWrap}><View style={s.hero}><Text style={s.heroTitle}>إدارة التمويل</Text><Text style={s.heroSub}>نسخة APK مستقلة بدون Expo Router</Text></View><View style={s.card}><Text style={s.title}>تسجيل الدخول</Text><TextInput style={s.input} value={login} onChangeText={setLogin} placeholder="admin@pm.sa" autoCapitalize="none" textAlign="right"/><TextInput style={s.input} value={password} onChangeText={setPassword} placeholder="كلمة المرور" secureTextEntry textAlign="right"/><TouchableOpacity style={s.btn} onPress={signIn} disabled={busy}>{busy ? <ActivityIndicator color="#fff"/> : <Text style={s.btnText}>دخول</Text>}</TouchableOpacity>{error ? <Text style={s.errText}>{error}</Text> : null}</View></ScrollView></View>;
  return <View style={s.safe}><StatusBar barStyle="dark-content" /><ScrollView contentContainerStyle={s.wrap}><View style={s.row}><TouchableOpacity style={s.out} onPress={() => { setToken(''); setUser(null); }}><Text style={s.outText}>خروج</Text></TouchableOpacity><View style={{flex:1}}><Text style={s.page}>التقارير</Text><Text style={s.mutedRight}>تقرير المتأخرين وتقرير المتأخرين مع علي</Text></View></View>{reports.map(r => <View key={r.title} style={s.card}><Text style={s.title}>{r.title}</Text><Text style={s.mutedRight}>{r.subtitle}</Text><View style={s.summary}><Box v={String(r.items.length)} l="عدد المتأخرين"/><Box v={money(r.total)} l="إجمالي المتأخر"/><Box v={r.ali ? money(r.aliTotal) : String(r.items.reduce((a,x)=>a+x.i.count,0))} l={r.ali ? 'ربح علي' : 'الأقساط'} /></View><View style={s.row}><Text style={s.mutedRight}>{r.items.length} سجل</Text><TouchableOpacity style={s.pdf} onPress={() => makePdf(r)} disabled={Boolean(pdfBusy)}>{pdfBusy === r.title ? <ActivityIndicator color="#fff"/> : <Text style={s.pdfText}>PDF</Text>}</TouchableOpacity></View></View>)}</ScrollView></View>;
}
function Box({v,l}) { return <View style={s.box}><Text style={s.boxVal} numberOfLines={1}>{v}</Text><Text style={s.boxLab} numberOfLines={1}>{l}</Text></View>; }
const s = StyleSheet.create({ safe:{flex:1,backgroundColor:'#f5f5f3',paddingTop:28}, loginWrap:{flexGrow:1,justifyContent:'center',padding:16,gap:14}, wrap:{padding:16,paddingBottom:40,gap:14}, hero:{backgroundColor:'#111',borderRadius:26,padding:20,gap:8}, heroTitle:{color:'#fff',fontSize:28,fontWeight:'900',textAlign:'right'}, heroSub:{color:'#ddd',fontSize:14,textAlign:'right'}, card:{backgroundColor:'#fff',borderRadius:22,padding:16,gap:12,borderWidth:1,borderColor:'#e8e6df'}, title:{fontSize:18,fontWeight:'900',color:'#111',textAlign:'right'}, input:{minHeight:50,borderWidth:1,borderColor:'#e8e6df',borderRadius:16,backgroundColor:'#f5f5f3',paddingHorizontal:12}, btn:{minHeight:52,borderRadius:18,backgroundColor:'#111',alignItems:'center',justifyContent:'center'}, btnText:{color:'#fff',fontWeight:'900',fontSize:16}, row:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12}, page:{fontSize:28,fontWeight:'900',color:'#111',textAlign:'right'}, mutedRight:{color:'#666',fontSize:13,lineHeight:20,textAlign:'right'}, out:{backgroundColor:'#fff',borderRadius:14,paddingHorizontal:14,paddingVertical:10,borderWidth:1,borderColor:'#e8e6df'}, outText:{color:'#a32d2d',fontWeight:'900'}, summary:{flexDirection:'row-reverse',gap:8}, box:{flex:1,backgroundColor:'#f5f5f3',borderRadius:14,padding:9}, boxVal:{fontSize:12,fontWeight:'900',textAlign:'right',color:'#111'}, boxLab:{fontSize:10,color:'#666',textAlign:'right'}, pdf:{backgroundColor:'#a32d2d',borderRadius:14,paddingHorizontal:18,paddingVertical:10,minWidth:70,alignItems:'center'}, pdfText:{color:'#fff',fontWeight:'900'}, errText:{color:'#a32d2d',textAlign:'right',fontWeight:'800'} });
registerRootComponent(App);
