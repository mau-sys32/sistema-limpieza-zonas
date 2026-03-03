import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

class HistorialPage extends StatefulWidget {
  const HistorialPage({super.key});

  @override
  State<HistorialPage> createState() => _HistorialPageState();
}

class _HistorialPageState extends State<HistorialPage> {
  String query = '';

  // ✅ Cambia aquí si tu colección no se llama "history"
  final CollectionReference<Map<String, dynamic>> col =
      FirebaseFirestore.instance.collection('history');

  String _txt(Map<String, dynamic> h) => (h['descripcion'] ??
          h['detalle'] ??
          h['mensaje'] ??
          h['action'] ??
          'Actividad')
      .toString();

  String _by(Map<String, dynamic> h) =>
      (h['usuarioNombre'] ?? h['usuario'] ?? h['user'] ?? h['email'] ?? '')
          .toString();

  DateTime? _when(Map<String, dynamic> h) {
    final v = h['createdAt'] ?? h['fecha'] ?? h['timestamp'];
    if (v is Timestamp) return v.toDate();
    // si viene como string ISO
    if (v is String) {
      return DateTime.tryParse(v);
    }
    return null;
  }

  String _fmt(DateTime? d) {
    if (d == null) return '';
    String two(int x) => x.toString().padLeft(2, '0');
    return '${d.year}-${two(d.month)}-${two(d.day)} ${two(d.hour)}:${two(d.minute)}';
  }

  bool _match(Map<String, dynamic> h) {
    final q = query.trim().toLowerCase();
    if (q.isEmpty) return true;
    final t = _txt(h).toLowerCase();
    final b = _by(h).toLowerCase();
    final f = _fmt(_when(h)).toLowerCase();
    return t.contains(q) || b.contains(q) || f.contains(q);
  }

  @override
  Widget build(BuildContext context) {
    final stream = col
        .orderBy('createdAt',
            descending: true) // si no existe, te digo abajo el fix
        .limit(200)
        .snapshots();

    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              const Expanded(
                child: Text(
                  'Historial',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
                ),
              ),
              IconButton(
                tooltip: 'Refrescar',
                onPressed: () => setState(() {}),
                icon: const Icon(Icons.refresh),
              ),
            ],
          ),
          const SizedBox(height: 12),
          TextField(
            decoration: const InputDecoration(
              hintText: 'Buscar en historial...',
              prefixIcon: Icon(Icons.search),
              border: OutlineInputBorder(),
            ),
            onChanged: (v) => setState(() => query = v),
          ),
          const SizedBox(height: 12),
          Expanded(
            child: Card(
              child: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
                stream: stream,
                builder: (context, snap) {
                  if (snap.hasError) {
                    return Padding(
                      padding: const EdgeInsets.all(14),
                      child: Text(
                        'Error Firestore: ${snap.error}\n\n'
                        'Si el error dice que falta índice o falta campo createdAt, dime qué campos guardas en el historial.',
                        style: const TextStyle(color: Colors.red),
                      ),
                    );
                  }
                  if (!snap.hasData) {
                    return const Center(child: CircularProgressIndicator());
                  }

                  final docs = snap.data!.docs;
                  final list = docs.map((d) => d.data()).where(_match).toList();

                  if (list.isEmpty) {
                    return const Center(child: Text('Sin historial'));
                  }

                  return ListView.separated(
                    itemCount: list.length,
                    separatorBuilder: (_, __) => const Divider(height: 1),
                    itemBuilder: (context, i) {
                      final h = list[i];
                      final txt = _txt(h);
                      final by = _by(h);
                      final at = _fmt(_when(h));

                      return ListTile(
                        leading: const Icon(Icons.history),
                        title: Text(txt),
                        subtitle: Text(
                          [
                            if (by.trim().isNotEmpty) 'Por: $by',
                            if (at.trim().isNotEmpty) 'Fecha: $at',
                          ].join(' • '),
                        ),
                      );
                    },
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}
