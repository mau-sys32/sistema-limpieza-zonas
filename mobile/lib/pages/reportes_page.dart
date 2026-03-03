import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../services/session.dart';

class ReportesPage extends StatefulWidget {
  const ReportesPage({super.key});

  @override
  State<ReportesPage> createState() => _ReportesPageState();
}

class _ReportesPageState extends State<ReportesPage> {
  String filter = 'todos'; // todos | pendiente | resuelto

  bool get isManager => Session.isBoss;

  Query<Map<String, dynamic>> _query() {
    final col = FirebaseFirestore.instance.collection('reports');
    if (filter == 'pendiente')
      return col
          .where('status', isEqualTo: 'pendiente')
          .orderBy('createdAt', descending: true);
    if (filter == 'resuelto')
      return col
          .where('status', isEqualTo: 'resuelto')
          .orderBy('createdAt', descending: true);
    return col.orderBy('createdAt', descending: true);
  }

  Future<void> _markResolved(String docId) async {
    if (!isManager) return;

    await FirebaseFirestore.instance.collection('reports').doc(docId).update({
      'status': 'resuelto',
      'resolvedAt': FieldValue.serverTimestamp(),
      'resolvedBy': Session.uid,
    });

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Marcado como resuelto ✅')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text('Reportes',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
          const SizedBox(height: 8),
          const Text('Incidencias enviadas por empleados (Firestore: reports).',
              style: TextStyle(color: Colors.grey)),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            children: [
              ChoiceChip(
                label: const Text('Todos'),
                selected: filter == 'todos',
                onSelected: (_) => setState(() => filter = 'todos'),
              ),
              ChoiceChip(
                label: const Text('Pendientes'),
                selected: filter == 'pendiente',
                onSelected: (_) => setState(() => filter = 'pendiente'),
              ),
              ChoiceChip(
                label: const Text('Resueltos'),
                selected: filter == 'resuelto',
                onSelected: (_) => setState(() => filter = 'resuelto'),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Expanded(
            child: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
              stream: _query().snapshots(),
              builder: (context, snap) {
                if (snap.hasError) {
                  return Center(child: Text('Error: ${snap.error}'));
                }
                if (!snap.hasData) {
                  return const Center(child: CircularProgressIndicator());
                }

                final docs = snap.data!.docs;
                if (docs.isEmpty)
                  return const Center(child: Text('Sin reportes'));

                return ListView.separated(
                  itemCount: docs.length,
                  separatorBuilder: (_, __) => const Divider(height: 1),
                  itemBuilder: (context, i) {
                    final d = docs[i];
                    final r = d.data();

                    final empleado = (r['employeeNombre'] ?? '—').toString();
                    final zona = (r['zoneNombre'] ?? '—').toString();
                    final obs = (r['observaciones'] ?? '').toString();
                    final photo = (r['photoURL'] ?? '').toString();
                    final status = (r['status'] ?? 'pendiente').toString();

                    return ListTile(
                      title: Text('$empleado • $zona'),
                      subtitle: Text(obs.isEmpty ? '—' : obs,
                          maxLines: 2, overflow: TextOverflow.ellipsis),
                      leading: photo.isNotEmpty
                          ? ClipRRect(
                              borderRadius: BorderRadius.circular(10),
                              child: Image.network(photo,
                                  width: 52, height: 52, fit: BoxFit.cover),
                            )
                          : const Icon(Icons.report_outlined),
                      trailing: Wrap(
                        spacing: 8,
                        children: [
                          Chip(
                            label: Text(status.toLowerCase() == 'resuelto'
                                ? 'Resuelto'
                                : 'Pendiente'),
                          ),
                          TextButton(
                            onPressed: () => _openDetail(context, d.id, r),
                            child: const Text('Ver'),
                          ),
                          if (isManager && status.toLowerCase() != 'resuelto')
                            ElevatedButton(
                              onPressed: () => _markResolved(d.id),
                              child: const Text('Resolver'),
                            ),
                        ],
                      ),
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  void _openDetail(BuildContext context, String id, Map<String, dynamic> r) {
    final empleado = (r['employeeNombre'] ?? '—').toString();
    final zona = (r['zoneNombre'] ?? '—').toString();
    final obs = (r['observaciones'] ?? '').toString();
    final photo = (r['photoURL'] ?? '').toString();
    final status = (r['status'] ?? 'pendiente').toString();

    showDialog(
      context: context,
      useRootNavigator: true,
      builder: (dialogContext) => AlertDialog(
        title: Text('Reporte • $status'),
        content: SizedBox(
          width: 520,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Empleado: $empleado'),
              Text('Zona: $zona'),
              const SizedBox(height: 10),
              const Text('Descripción:',
                  style: TextStyle(fontWeight: FontWeight.w700)),
              Text(obs.isEmpty ? '—' : obs),
              const SizedBox(height: 12),
              if (photo.isNotEmpty) ...[
                const Text('Foto:',
                    style: TextStyle(fontWeight: FontWeight.w700)),
                const SizedBox(height: 8),
                ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: Image.network(photo, fit: BoxFit.cover),
                ),
              ]
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () =>
                Navigator.of(dialogContext).pop(), // ✅ SOLO CIERRA EL DIALOG
            child: const Text('Cerrar'),
          ),
        ],
      ),
    );
  }
}
