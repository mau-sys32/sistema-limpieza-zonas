import 'package:flutter/material.dart';
import '../services/api_client.dart';
import '../services/session.dart';

class ZonasPage extends StatefulWidget {
  const ZonasPage({super.key});

  @override
  State<ZonasPage> createState() => _ZonasPageState();
}

class _ZonasPageState extends State<ZonasPage> {
  final api = ApiClient();

  bool loading = true;
  String? error;
  String? debugInfo;

  List<dynamic> zonas = [];
  String query = '';

  bool get isManager => Session.isBoss;

  @override
  void initState() {
    super.initState();
    _load();
  }

  String _zonaId(Map<String, dynamic> z) {
    final v = z['id'] ?? z['_id'] ?? z['docId'];
    return (v ?? '').toString();
  }

  List<dynamic> get filtered {
    final q = query.trim().toLowerCase();
    if (q.isEmpty) return zonas;

    return zonas.where((e) {
      final z = Map<String, dynamic>.from(e as Map);
      final nombre = (z['nombre'] ?? z['name'] ?? '').toString().toLowerCase();
      final area = (z['area'] ?? '').toString().toLowerCase();
      final frecuencia = (z['frecuencia'] ?? '').toString().toLowerCase();
      final prioridad = (z['prioridad'] ?? '').toString().toLowerCase();

      return nombre.contains(q) ||
          area.contains(q) ||
          frecuencia.contains(q) ||
          prioridad.contains(q);
    }).toList();
  }

  Future<void> _load() async {
    setState(() {
      loading = true;
      error = null;
      debugInfo = null;
    });

    try {
      final dbg = await api.get('/api/debug/auth-header');
      debugInfo = 'DBG: $dbg';

      final data = await api.get('/api/zonas');

      if (data is Map && data['ok'] == false) {
        throw Exception((data['error'] ?? 'Error API').toString());
      }

      List<dynamic> list;
      if (data is List) {
        list = data;
      } else if (data is Map && data['data'] is List) {
        list = List<dynamic>.from(data['data']);
      } else if (data is Map && data['zonas'] is List) {
        list = List<dynamic>.from(data['zonas']);
      } else {
        throw Exception('Respuesta inesperada del API: ${data.runtimeType}');
      }

      setState(() => zonas = list);
    } catch (e) {
      setState(() {
        zonas = [];
        error = e.toString().replaceFirst('Exception: ', '');
      });
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _newZona() async {
    if (!isManager) return;

    final res = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (_) => const _ZonaDialog(),
    );
    if (res == null) return;

    try {
      await api.post('/api/zonas', res);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Zona creada')),
        );
      }
      await _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e')),
        );
      }
    }
  }

  Future<void> _editZona(Map<String, dynamic> z) async {
    if (!isManager) return;

    final id = _zonaId(z);
    if (id.isEmpty) return;

    final res = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (_) => _ZonaDialog(
        initial: {
          'nombre': z['nombre'] ?? z['name'] ?? '',
          'area': z['area'] ?? '',
          'frecuencia': z['frecuencia'] ?? 'diaria',
          'prioridad': z['prioridad'] ?? 'Media',
        },
      ),
    );
    if (res == null) return;

    try {
      await api.put('/api/zonas/$id', res);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Zona actualizada')),
        );
      }
      await _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e')),
        );
      }
    }
  }

  Future<void> _deleteZona(Map<String, dynamic> z) async {
    if (!isManager) return;

    final id = _zonaId(z);
    if (id.isEmpty) return;

    final nombre = (z['nombre'] ?? z['name'] ?? 'Zona').toString();

    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Eliminar zona'),
        content: Text('¿Eliminar "$nombre"?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancelar'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Eliminar'),
          ),
        ],
      ),
    );

    if (ok != true) return;

    try {
      await api.delete('/api/zonas/$id');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Zona eliminada')),
        );
      }
      await _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final list = filtered;

    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              const Expanded(
                child: Text(
                  'Zonas',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
                ),
              ),
              if (isManager)
                ElevatedButton.icon(
                  onPressed: _newZona,
                  icon: const Icon(Icons.add),
                  label: const Text('Zona'),
                ),
              const SizedBox(width: 8),
              IconButton(
                tooltip: 'Refrescar',
                onPressed: _load,
                icon: const Icon(Icons.refresh),
              ),
            ],
          ),
          const SizedBox(height: 12),
          TextField(
            decoration: const InputDecoration(
              hintText: 'Buscar zona...',
              prefixIcon: Icon(Icons.search),
              border: OutlineInputBorder(),
            ),
            onChanged: (v) => setState(() => query = v),
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
          Expanded(
            child: Card(
              child: list.isEmpty
                  ? const Center(child: Text('Sin zonas'))
                  : ListView.separated(
                      itemCount: list.length,
                      separatorBuilder: (_, __) => const Divider(height: 1),
                      itemBuilder: (context, i) {
                        final z = Map<String, dynamic>.from(list[i] as Map);
                        final nombre =
                            (z['nombre'] ?? z['name'] ?? 'Sin nombre')
                                .toString();
                        final area = (z['area'] ?? '').toString();
                        final frecuencia = (z['frecuencia'] ?? '').toString();
                        final prioridad = (z['prioridad'] ?? '').toString();

                        return ListTile(
                          title: Text(nombre),
                          subtitle: Text([area, frecuencia, prioridad]
                              .where((x) => x.trim().isNotEmpty)
                              .join(' • ')),
                          trailing: isManager
                              ? Wrap(
                                  spacing: 6,
                                  children: [
                                    IconButton(
                                      tooltip: 'Editar',
                                      icon: const Icon(Icons.edit),
                                      onPressed: () => _editZona(z),
                                    ),
                                    IconButton(
                                      tooltip: 'Eliminar',
                                      icon: const Icon(Icons.delete_outline),
                                      onPressed: () => _deleteZona(z),
                                    ),
                                  ],
                                )
                              : null,
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

class _ZonaDialog extends StatefulWidget {
  final Map<String, dynamic>? initial;
  const _ZonaDialog({this.initial});

  @override
  State<_ZonaDialog> createState() => _ZonaDialogState();
}

class _ZonaDialogState extends State<_ZonaDialog> {
  final nombre = TextEditingController();
  final area = TextEditingController();

  String frecuencia = 'diaria';
  String prioridad = 'Media';

  @override
  void initState() {
    super.initState();
    final ini = widget.initial;
    if (ini != null) {
      nombre.text = (ini['nombre'] ?? '').toString();
      area.text = (ini['area'] ?? '').toString();
      frecuencia = (ini['frecuencia'] ?? 'diaria').toString();
      prioridad = (ini['prioridad'] ?? 'Media').toString();
    }
  }

  @override
  void dispose() {
    nombre.dispose();
    area.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isEdit = widget.initial != null;

    return AlertDialog(
      title: Text(isEdit ? 'Editar zona' : 'Nueva zona'),
      content: SizedBox(
        width: 420,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: nombre,
              decoration: const InputDecoration(
                labelText: 'Nombre',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: area,
              decoration: const InputDecoration(
                labelText: 'Área',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              value: frecuencia,
              decoration: const InputDecoration(
                labelText: 'Frecuencia',
                border: OutlineInputBorder(),
              ),
              items: const [
                DropdownMenuItem(value: 'diaria', child: Text('Diaria')),
                DropdownMenuItem(value: 'semanal', child: Text('Semanal')),
                DropdownMenuItem(
                    value: 'cada 2 horas', child: Text('Cada 2 horas')),
              ],
              onChanged: (v) => setState(() => frecuencia = v ?? 'diaria'),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              value: prioridad,
              decoration: const InputDecoration(
                labelText: 'Prioridad',
                border: OutlineInputBorder(),
              ),
              items: const [
                DropdownMenuItem(value: 'Alta', child: Text('Alta')),
                DropdownMenuItem(value: 'Media', child: Text('Media')),
                DropdownMenuItem(value: 'Baja', child: Text('Baja')),
              ],
              onChanged: (v) => setState(() => prioridad = v ?? 'Media'),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancelar'),
        ),
        ElevatedButton(
          onPressed: () {
            if (nombre.text.trim().isEmpty) return;
            Navigator.pop(context, {
              'nombre': nombre.text.trim(),
              'area': area.text.trim(),
              'frecuencia': frecuencia,
              'prioridad': prioridad,
            });
          },
          child: const Text('Guardar'),
        ),
      ],
    );
  }
}
