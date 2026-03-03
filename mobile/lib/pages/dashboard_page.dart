import 'package:flutter/material.dart';
import '../services/api_client.dart';

class DashboardPage extends StatefulWidget {
  const DashboardPage({super.key});

  @override
  State<DashboardPage> createState() => _DashboardPageState();
}

class _DashboardPageState extends State<DashboardPage> {
  final api = ApiClient();

  bool loading = true;
  String? error;
  String? debugInfo;

  int zonasCount = 0;
  int tareasCount = 0;
  int tareasPendientes = 0;
  int tareasProceso = 0;
  int tareasCompletadas = 0;
  int personalCount = 0;

  List<Map<String, dynamic>> recentTareas = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  // Soporta: [] ó {data:[]} ó {zonas:[]} ó {tareas:[]} etc.
  List<dynamic> _asList(dynamic data, List<String> keys) {
    if (data is List) return data;
    if (data is Map) {
      for (final k in keys) {
        final v = data[k];
        if (v is List) return v;
      }
    }
    return const [];
  }

  String _taskStatus(Map<String, dynamic> t) {
    // soporta diferentes nombres
    final raw = (t['estado'] ?? t['status'] ?? t['progreso'] ?? '').toString();
    return raw.trim();
  }

  String _taskTitle(Map<String, dynamic> t) {
    return (t['titulo'] ?? t['title'] ?? t['nombre'] ?? 'Tarea').toString();
  }

  String _taskZona(Map<String, dynamic> t) {
    return (t['zonaNombre'] ?? t['zona'] ?? t['zonaId'] ?? t['zone'] ?? '')
        .toString();
  }

  Future<void> _load() async {
    setState(() {
      loading = true;
      error = null;
      debugInfo = null;
    });

    try {
      // debug (opcional)
      final dbg = await api.get('/api/debug/auth-header');
      debugInfo = 'DBG: $dbg';

      // Cargar en paralelo
      final results = await Future.wait([
        api.get('/api/zonas'),
        api.get('/api/tareas'),
        api.get('/api/personal'),
      ]);

      final zonasRaw = results[0];
      final tareasRaw = results[1];
      final personalRaw = results[2];

      // Si API devuelve {ok:false,...}
      void checkErr(dynamic x) {
        if (x is Map && x['ok'] == false) {
          throw Exception(x['error'] ?? 'Error API');
        }
      }

      checkErr(zonasRaw);
      checkErr(tareasRaw);
      checkErr(personalRaw);

      final zonas = _asList(zonasRaw, const ['data', 'zonas']);
      final tareas = _asList(tareasRaw, const ['data', 'tareas', 'tasks']);
      final personal =
          _asList(personalRaw, const ['data', 'personal', 'users']);

      // Conteos
      zonasCount = zonas.length;
      tareasCount = tareas.length;
      personalCount = personal.length;

      // Clasifica estados (soporta variantes)
      int pend = 0, proc = 0, comp = 0;
      final normalized = <Map<String, dynamic>>[];

      for (final e in tareas) {
        if (e is! Map) continue;
        final t = Map<String, dynamic>.from(e as Map);
        final st = _taskStatus(t).toLowerCase();

        if (st.contains('pend'))
          pend++;
        else if (st.contains('proc') || st.contains('en proceso'))
          proc++;
        else if (st.contains('comp') ||
            st.contains('termin') ||
            st.contains('final'))
          comp++;
        else {
          // si viene vacío, lo contamos como pendiente
          if (st.trim().isEmpty) pend++;
        }

        normalized.add(t);
      }

      tareasPendientes = pend;
      tareasProceso = proc;
      tareasCompletadas = comp;

      // “Recientes” (sin depender de fecha exacta: intenta createdAt / fecha / timestamp)
      normalized.sort((a, b) {
        dynamic da =
            a['updatedAt'] ?? a['createdAt'] ?? a['fecha'] ?? a['timestamp'];
        dynamic db =
            b['updatedAt'] ?? b['createdAt'] ?? b['fecha'] ?? b['timestamp'];

        // si viene como String ISO, compara lexicográfico
        final sa = da?.toString() ?? '';
        final sb = db?.toString() ?? '';
        return sb.compareTo(sa);
      });

      recentTareas = normalized.take(5).toList();

      setState(() {});
    } catch (e) {
      setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Widget _metricCard({
    required String title,
    required String value,
    required IconData icon,
    String? subtitle,
  }) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            Icon(icon, size: 28),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      style: const TextStyle(fontWeight: FontWeight.w700)),
                  if (subtitle != null) ...[
                    const SizedBox(height: 2),
                    Text(subtitle,
                        style:
                            const TextStyle(fontSize: 12, color: Colors.grey)),
                  ],
                ],
              ),
            ),
            Text(value,
                style:
                    const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
          ],
        ),
      ),
    );
  }

  Widget _pill(String text) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(999),
        color: Colors.black.withOpacity(.06),
      ),
      child: Text(text, style: const TextStyle(fontSize: 12)),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Header
          Row(
            children: [
              const Expanded(
                child: Text(
                  'Dashboard',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
                ),
              ),
              IconButton(
                tooltip: 'Refrescar',
                onPressed: _load,
                icon: const Icon(Icons.refresh),
              ),
            ],
          ),
          const SizedBox(height: 12),

          if (loading) const LinearProgressIndicator(),
          if (debugInfo != null) ...[
            const SizedBox(height: 10),
            Text(debugInfo!,
                style: const TextStyle(fontSize: 12, color: Colors.grey)),
          ],
          if (error != null) ...[
            const SizedBox(height: 10),
            Text(error!, style: const TextStyle(color: Colors.red)),
          ],
          const SizedBox(height: 12),

          // Métricas
          Wrap(
            spacing: 12,
            runSpacing: 12,
            children: [
              SizedBox(
                width: 340,
                child: _metricCard(
                  title: 'Zonas',
                  value: '$zonasCount',
                  icon: Icons.location_on_outlined,
                  subtitle: 'Zonas registradas',
                ),
              ),
              SizedBox(
                width: 340,
                child: _metricCard(
                  title: 'Tareas',
                  value: '$tareasCount',
                  icon: Icons.checklist_rtl,
                  subtitle: 'Total de tareas',
                ),
              ),
              SizedBox(
                width: 340,
                child: _metricCard(
                  title: 'Personal',
                  value: '$personalCount',
                  icon: Icons.people_alt_outlined,
                  subtitle: 'Empleados registrados',
                ),
              ),
            ],
          ),

          const SizedBox(height: 12),

          // Estado de tareas (pills)
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _pill('Pendientes: $tareasPendientes'),
              _pill('En proceso: $tareasProceso'),
              _pill('Completadas: $tareasCompletadas'),
            ],
          ),

          const SizedBox(height: 12),

          // Recientes
          Expanded(
            child: Card(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Text(
                      'Tareas recientes',
                      style: TextStyle(fontWeight: FontWeight.w800),
                    ),
                    const SizedBox(height: 8),
                    Expanded(
                      child: recentTareas.isEmpty
                          ? const Center(child: Text('Sin tareas para mostrar'))
                          : ListView.separated(
                              itemCount: recentTareas.length,
                              separatorBuilder: (_, __) =>
                                  const Divider(height: 1),
                              itemBuilder: (context, i) {
                                final t = recentTareas[i];
                                final title = _taskTitle(t);
                                final st = _taskStatus(t);
                                final zona = _taskZona(t);

                                final subtitle = [
                                  if (zona.trim().isNotEmpty) 'Zona: $zona',
                                  if (st.trim().isNotEmpty) 'Estado: $st',
                                ].join(' • ');

                                return ListTile(
                                  leading: const Icon(Icons.task_alt),
                                  title: Text(title),
                                  subtitle: Text(subtitle),
                                );
                              },
                            ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
