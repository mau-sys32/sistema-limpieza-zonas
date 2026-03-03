import 'package:flutter/material.dart';
import '../services/api_client.dart';

class PersonalPage extends StatefulWidget {
  const PersonalPage({super.key});

  @override
  State<PersonalPage> createState() => _PersonalPageState();
}

class _PersonalPageState extends State<PersonalPage> {
  final api = ApiClient();

  bool loading = true;
  bool creating = false;
  String? error;
  String query = '';

  List<dynamic> people = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

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

  String _idOf(Map<String, dynamic> x) =>
      ((x['id'] ?? x['_id'] ?? x['docId']) ?? '').toString();

  String _nameOf(Map<String, dynamic> u) =>
      (u['nombre'] ?? u['name'] ?? u['displayName'] ?? 'Sin nombre').toString();

  String _emailOf(Map<String, dynamic> u) =>
      (u['correo'] ?? u['email'] ?? u['mail'] ?? '').toString();

  String _rolOf(Map<String, dynamic> u) =>
      (u['rol'] ?? u['role'] ?? 'empleado').toString();

  String _statusOf(Map<String, dynamic> u) =>
      (u['estado'] ?? u['status'] ?? 'activo').toString();

  List<dynamic> get filtered {
    final q = query.trim().toLowerCase();
    if (q.isEmpty) return people;

    return people.where((e) {
      final u = Map<String, dynamic>.from(e as Map);
      final n = _nameOf(u).toLowerCase();
      final em = _emailOf(u).toLowerCase();
      final r = _rolOf(u).toLowerCase();
      return n.contains(q) || em.contains(q) || r.contains(q);
    }).toList();
  }

  String _humanApiError(Object e) {
    final s = e.toString().replaceFirst('Exception: ', '');
    return s;
  }

  void _snack(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  Future<void> _load() async {
    setState(() {
      loading = true;
      error = null;
    });

    try {
      final data = await api.get('/api/personal');

      if (data is Map && data['ok'] == false) {
        throw Exception(
            (data['error'] ?? data['message'] ?? 'Error API').toString());
      }

      final list = _asList(data, const ['data', 'personal', 'users']);
      setState(() => people = list);
    } catch (e) {
      setState(() {
        people = [];
        error = _humanApiError(e);
      });
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _newUser() async {
    final body = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (_) => const _PersonalDialog(),
    );
    if (body == null) return;

    setState(() => creating = true);

    try {
      final res = await api.post('/api/personal', body);

      if (res is Map && res['ok'] == false) {
        throw Exception(
            (res['error'] ?? res['message'] ?? 'No se pudo crear').toString());
      }

      _snack('Empleado creado ✅');
      await _load();
    } catch (e) {
      _snack('Error: ${_humanApiError(e)}');
    } finally {
      if (mounted) setState(() => creating = false);
    }
  }

  Future<void> _editUser(Map<String, dynamic> u) async {
    final id = _idOf(u);
    if (id.isEmpty) {
      _snack('No se encontró id del empleado');
      return;
    }

    final body = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (_) => _PersonalDialog(
        initial: {
          'nombre': _nameOf(u),
          'correo': _emailOf(u),
          'rol': _rolOf(u),
          'estado': _statusOf(u),
        },
        isEdit: true,
      ),
    );
    if (body == null) return;

    try {
      final res = await api.patch('/api/personal/$id', body);

      if (res is Map && res['ok'] == false) {
        throw Exception(
            (res['error'] ?? res['message'] ?? 'No se pudo actualizar')
                .toString());
      }

      _snack('Empleado actualizado ✅');
      await _load();
    } catch (e) {
      _snack('Error: ${_humanApiError(e)}');
    }
  }

  Future<void> _toggleActive(Map<String, dynamic> u) async {
    final id = _idOf(u);
    if (id.isEmpty) return;

    final current = _statusOf(u).toLowerCase();
    final next = current.contains('inact') ? 'activo' : 'inactivo';

    try {
      final res = await api.patch('/api/personal/$id', {'estado': next});
      if (res is Map && res['ok'] == false) {
        throw Exception(
            (res['error'] ?? res['message'] ?? 'No se pudo cambiar estado')
                .toString());
      }

      await _load();
    } catch (e) {
      _snack('Error: ${_humanApiError(e)}');
    }
  }

  Future<void> _deleteUser(Map<String, dynamic> u) async {
    final id = _idOf(u);
    final name = _nameOf(u);
    if (id.isEmpty) return;

    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Eliminar empleado'),
        content: Text('¿Eliminar "$name"?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancelar')),
          ElevatedButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Eliminar')),
        ],
      ),
    );

    if (ok != true) return;

    try {
      final res = await api.delete('/api/personal/$id');
      if (res is Map && res['ok'] == false) {
        throw Exception(
            (res['error'] ?? res['message'] ?? 'No se pudo eliminar')
                .toString());
      }

      _snack('Empleado eliminado ✅');
      await _load();
    } catch (e) {
      _snack('Error: ${_humanApiError(e)}');
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
                  'Personal',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
                ),
              ),
              ElevatedButton.icon(
                onPressed: (loading || creating) ? null : _newUser,
                icon: creating
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.person_add_alt_1),
                label: const Text('Empleado'),
              ),
              const SizedBox(width: 8),
              IconButton(
                tooltip: 'Refrescar',
                onPressed: loading ? null : _load,
                icon: const Icon(Icons.refresh),
              ),
            ],
          ),
          const SizedBox(height: 12),
          TextField(
            decoration: const InputDecoration(
              hintText: 'Buscar empleado...',
              prefixIcon: Icon(Icons.search),
              border: OutlineInputBorder(),
            ),
            onChanged: (v) => setState(() => query = v),
          ),
          const SizedBox(height: 12),
          if (loading) const LinearProgressIndicator(),
          if (error != null) ...[
            const SizedBox(height: 10),
            Text(error!, style: const TextStyle(color: Colors.red)),
          ],
          const SizedBox(height: 12),
          Expanded(
            child: Card(
              child: list.isEmpty
                  ? const Center(child: Text('Sin personal'))
                  : ListView.separated(
                      itemCount: list.length,
                      separatorBuilder: (_, __) => const Divider(height: 1),
                      itemBuilder: (context, i) {
                        final u = Map<String, dynamic>.from(list[i] as Map);
                        final name = _nameOf(u);
                        final email = _emailOf(u);
                        final rol = _rolOf(u);
                        final st = _statusOf(u);

                        return ListTile(
                          leading: const Icon(Icons.person_outline),
                          title: Text(name),
                          subtitle: Text(
                            [
                              if (email.trim().isNotEmpty) email,
                              'Rol: $rol',
                              'Estado: $st',
                            ].join(' • '),
                          ),
                          trailing: Wrap(
                            spacing: 6,
                            children: [
                              IconButton(
                                tooltip: 'Activar/Desactivar',
                                icon: const Icon(Icons.toggle_on_outlined),
                                onPressed: () => _toggleActive(u),
                              ),
                              IconButton(
                                tooltip: 'Editar',
                                icon: const Icon(Icons.edit),
                                onPressed: () => _editUser(u),
                              ),
                              IconButton(
                                tooltip: 'Eliminar',
                                icon: const Icon(Icons.delete_outline),
                                onPressed: () => _deleteUser(u),
                              ),
                            ],
                          ),
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

class _PersonalDialog extends StatefulWidget {
  final Map<String, dynamic>? initial;
  final bool isEdit;
  const _PersonalDialog({this.initial, this.isEdit = false});

  @override
  State<_PersonalDialog> createState() => _PersonalDialogState();
}

class _PersonalDialogState extends State<_PersonalDialog> {
  final nombre = TextEditingController();
  final correo = TextEditingController();
  final password = TextEditingController(); // ✅ solo crear

  String rol = 'empleado';
  String estado = 'activo';

  @override
  void initState() {
    super.initState();
    final ini = widget.initial;
    if (ini != null) {
      nombre.text = (ini['nombre'] ?? '').toString();
      correo.text = (ini['correo'] ?? '').toString();

      final r = (ini['rol'] ?? 'empleado').toString().trim().toLowerCase();
      if (r.contains('admin')) {
        rol = 'admin';
      } else if (r.contains('super')) {
        rol = 'supervisor';
      } else {
        rol = 'empleado';
      }

      final s = (ini['estado'] ?? 'activo').toString().trim().toLowerCase();
      estado = s.contains('inact') ? 'inactivo' : 'activo';
    }
  }

  @override
  void dispose() {
    nombre.dispose();
    correo.dispose();
    password.dispose();
    super.dispose();
  }

  void _warn(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(widget.isEdit ? 'Editar empleado' : 'Nuevo empleado'),
      content: SizedBox(
        width: 460,
        child: SingleChildScrollView(
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
                controller: correo,
                decoration: const InputDecoration(
                  labelText: 'Correo',
                  border: OutlineInputBorder(),
                ),
              ),
              if (!widget.isEdit) ...[
                const SizedBox(height: 12),
                TextField(
                  controller: password,
                  obscureText: true,
                  decoration: const InputDecoration(
                    labelText: 'Contraseña',
                    hintText: 'Mínimo 6 caracteres',
                    border: OutlineInputBorder(),
                  ),
                ),
              ],
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                value: rol,
                decoration: const InputDecoration(
                  labelText: 'Rol',
                  border: OutlineInputBorder(),
                ),
                items: const [
                  DropdownMenuItem(value: 'empleado', child: Text('Empleado')),
                  DropdownMenuItem(
                      value: 'supervisor', child: Text('Supervisor')),
                  DropdownMenuItem(value: 'admin', child: Text('Admin')),
                ],
                onChanged: (v) => setState(() => rol = v ?? 'empleado'),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                value: estado,
                decoration: const InputDecoration(
                  labelText: 'Estado',
                  border: OutlineInputBorder(),
                ),
                items: const [
                  DropdownMenuItem(value: 'activo', child: Text('Activo')),
                  DropdownMenuItem(value: 'inactivo', child: Text('Inactivo')),
                ],
                onChanged: (v) => setState(() => estado = v ?? 'activo'),
              ),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancelar'),
        ),
        ElevatedButton(
          onPressed: () {
            final n = nombre.text.trim();
            final c = correo.text.trim();
            final p = password.text.trim();

            if (n.isEmpty) return _warn('Escribe el nombre');
            if (c.isEmpty) return _warn('Escribe el correo');

            if (!widget.isEdit) {
              if (p.length < 6) return _warn('Contraseña mínimo 6 caracteres');
            }

            final body = <String, dynamic>{
              'nombre': n,
              'correo': c,
              'rol': rol,
              'estado': estado,
            };

            if (!widget.isEdit) {
              body['password'] = p;
            }

            Navigator.pop(context, body);
          },
          child: const Text('Guardar'),
        ),
      ],
    );
  }
}
