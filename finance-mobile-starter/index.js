import { registerRootComponent } from 'expo';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AuthProvider, useSession } from './src/contexts/auth-context';
import { getClients, getPartnerClients } from './src/services/api';
import { exportReportPdf } from './src/services/report-export';
import { buildLateClientsReport, buildLateClientsWithAliReport } from './src/utils/reports';

function Root() {
  return <SafeAreaProvider><AuthProvider><StatusBar barStyle="dark-content" /><Shell /></AuthProvider></SafeAreaProvider>;
}

function Shell() {
  const auth = useSession();
  if (auth.isLoading) return <Center text="جاري التحميل" />;
  return auth.isAuthenticated ? <Reports /> : <Login />;
}

function Center({ text }) {
  return <SafeAreaView style={s.center}><ActivityIndicator color="#111" /><Text style={s.muted}>{text}</Text></SafeAreaView>;
}

function Login() {
  const { signIn } = useSession();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (!login || !password) return Alert.alert('تنبيه', 'أدخل بيانات الدخول');
    try { setBusy(true); await signIn({ login: login.trim(), password: password.trim() }); }
    catch (e) { Alert.alert('خطأ', e instanceof Error ? e.message : 'تعذر الدخول'); }
    finally { setBusy(false); }
  }
  return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.loginWrap}>
    <View style={s.hero}><Text style={s.heroTitle}>إدارة التمويل</Text><Text style={s.heroSub}>نسخة APK بدون Expo Router</Text></View>
    <View style={s.card}><Text style={s.title}>تسجيل الدخول</Text><TextInput style={s.input} value={login} onChangeText={setLogin} placeholder="admin@pm.sa" autoCapitalize="none" textAlign="right" /><TextInput style={s.input} value={password} onChangeText={setPassword} placeholder="كلمة المرور" secureTextEntry textAlign="right" /><TouchableOpacity style={s.btn} onPress={submit} disabled={busy}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>دخول</Text>}</TouchableOpacity></View>
  </ScrollView></SafeAreaView>;
}

function isAli(session) {
  return String(session?.user?.email || '').toLowerCase() === 'ali@pm.sa' || String(session?.user?.account_slug || '').toLowerCase() === 'ali';
}

function Reports() {
  const auth = useSession();
  const [clients, setClients] = useState([]);
  const [aliClients, setAliClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const ali = isAli(auth.session);
  async function load() {
    try { setError(''); const [all, shared] = await Promise.all([getClients('all'), ali ? getPartnerClients() : Promise.resolve([])]); setClients(all); setAliClients(shared); }
    catch (e) { setError(e instanceof Error ? e.message : 'تعذر تحميل البيانات'); }
    finally { setLoading(false); setRefreshing(false); }
  }
  useEffect(() => { load(); }, [ali]);
  const reports = useMemo(() => [buildLateClientsReport(clients), buildLateClientsWithAliReport(ali ? aliClients : clients)], [clients, aliClients, ali]);
  async function pdf(report) { try { await exportReportPdf(report); } catch (e) { Alert.alert('PDF', e instanceof Error ? e.message : 'تعذر إنشاء PDF'); } }
  return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.wrap} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
    <View style={s.row}><TouchableOpacity onPress={() => auth.signOut()} style={s.out}><Text style={s.outText}>خروج</Text></TouchableOpacity><View style={{ flex: 1 }}><Text style={s.page}>التقارير</Text><Text style={s.mutedRight}>تقرير المتأخرين وتقرير المتأخرين مع علي</Text></View></View>
    {loading ? <CenterCard text="جاري تحميل التقارير" /> : null}
    {error ? <View style={s.err}><Text style={s.errText}>{error}</Text></View> : null}
    {!loading && !error ? reports.map(r => <View key={r.kind} style={s.card}><Text style={s.title}>{r.title}</Text><Text style={s.mutedRight}>{r.subtitle}</Text><View style={s.summary}>{r.summary.slice(0,3).map(x => <View key={x.label} style={s.box}><Text style={s.boxVal}>{x.value}</Text><Text style={s.boxLab}>{x.label}</Text></View>)}</View><View style={s.row}><Text style={s.muted}>{r.rows.length} سجل</Text><TouchableOpacity style={s.pdf} onPress={() => pdf(r)}><Text style={s.pdfText}>PDF</Text></TouchableOpacity></View></View>) : null}
  </ScrollView></SafeAreaView>;
}

function CenterCard({ text }) { return <View style={s.card}><ActivityIndicator color="#111" /><Text style={s.muted}>{text}</Text></View>; }

const s = StyleSheet.create({ safe:{flex:1,backgroundColor:'#f5f5f3'}, center:{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:'#f5f5f3',gap:10}, loginWrap:{flexGrow:1,justifyContent:'center',padding:16,gap:14}, wrap:{padding:16,paddingBottom:40,gap:14}, hero:{backgroundColor:'#111',borderRadius:26,padding:20,gap:8}, heroTitle:{color:'#fff',fontSize:28,fontWeight:'900',textAlign:'right'}, heroSub:{color:'#ddd',fontSize:14,textAlign:'right'}, card:{backgroundColor:'#fff',borderRadius:22,padding:16,gap:12,borderWidth:1,borderColor:'#e8e6df'}, title:{fontSize:18,fontWeight:'900',color:'#111',textAlign:'right'}, input:{minHeight:50,borderWidth:1,borderColor:'#e8e6df',borderRadius:16,backgroundColor:'#f5f5f3',paddingHorizontal:12}, btn:{minHeight:52,borderRadius:18,backgroundColor:'#111',alignItems:'center',justifyContent:'center'}, btnText:{color:'#fff',fontWeight:'900',fontSize:16}, row:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12}, page:{fontSize:28,fontWeight:'900',color:'#111',textAlign:'right'}, muted:{color:'#666',fontWeight:'700',textAlign:'center'}, mutedRight:{color:'#666',fontSize:13,lineHeight:20,textAlign:'right'}, out:{backgroundColor:'#fff',borderRadius:14,paddingHorizontal:14,paddingVertical:10,borderWidth:1,borderColor:'#e8e6df'}, outText:{color:'#a32d2d',fontWeight:'900'}, summary:{flexDirection:'row-reverse',gap:8}, box:{flex:1,backgroundColor:'#f5f5f3',borderRadius:14,padding:9}, boxVal:{fontSize:12,fontWeight:'900',textAlign:'right',color:'#111'}, boxLab:{fontSize:10,color:'#666',textAlign:'right'}, pdf:{backgroundColor:'#a32d2d',borderRadius:14,paddingHorizontal:18,paddingVertical:10}, pdfText:{color:'#fff',fontWeight:'900'}, err:{backgroundColor:'#fcebeb',borderRadius:18,padding:14}, errText:{color:'#a32d2d',textAlign:'right',fontWeight:'800'} });

registerRootComponent(Root);
