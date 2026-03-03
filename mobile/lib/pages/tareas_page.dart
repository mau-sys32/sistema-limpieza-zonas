import 'dart:convert';
import 'package:http/http.dart' as http;

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../services/api_client.dart';
import '../services/session.dart';

import '../ui/app_theme.dart';
import '../ui/widgets.dart';

class TareasPage extends StatefulWidget {
  const TareasPage({super.key});

  @override
  State<TareasPage> createState() => _TareasPageState();
}

class _TareasPageState extends State<TareasPage> {
  final api = ApiClient();
  final picker = ImagePicker();

  bool loading = true;
  String? error;
  String? debugInfo;

  List<dynamic> tareas = [];
  List<dynamic> zonas = [];
  String query = '';

  bool get isManager => Session.isBoss;

  @override
  void initState() {
    super.initState();
    _loadAll();
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

  String _idOf(Map<String, dynamic> x) {
    final v = x['id'] ?? x['_id'] ?? x['docId'];
    return (v ?? '').toString();
  }

  String _titleOf(Map<String, dynamic> t) =>
      (t['titulo'] ?? t['title'] ?? t['nombre'] ?? 'Tarea').toString();

  String _statusOf(Map<String, dynamic> t) =>
      (t['estado'] ?? t['status'] ?? 'Pendiente').toString();

  String _zonaNameOf(Map<String, dynamic> t) => (t['zonaNombre'] ??
          t['zoneNombre'] ??
          t['zona'] ??
          t['zonaName'] ??
          t['zone'] ??
          '')
      .toString();

  List<dynamic> get filtered {
    final q = query.trim().toLowerCase();
    if (q.isEmpty) return tareas;

    return tareas.where((e) {
      final t = Map<String, dynamic>.from(e as Map);
      final title = _titleOf(t).toLowerCase();
      final st = _statusOf(t).toLowerCase();
      final zn = _zonaNameOf(t).toLowerCase();
      return title.contains(q) || st.contains(q) || zn.contains(q);
    }).toList();
  }

  Future<dynamic> _tryMineTasksFallback() async {
    try {
      return await api.get('/api/tareas/mias');
    } catch (_) {
      return api.get('/api/tareas');
    }
  }

  Future<void> _loadAll() async {
    setState(() {
      loading = true;
      error = null;
      debugInfo = null;
    });

    try {
      final dbg = await api.get('/api/debug/auth-header');
      debugInfo = 'DBG: $dbg';

      final tareasFuture =
          isManager ? api.get('/api/tareas') : _tryMineTasksFallback();

      final futures = <Future<dynamic>>[
        if (isManager) api.get('/api/zonas'),
        tareasFuture,
      ];

      final results = await Future.wait(futures);

      dynamic zonasRaw;
      dynamic tareasRaw;

      if (isManager) {
        zonasRaw = results[0];
        tareasRaw = results[1];
      } else {
        tareasRaw = results[0];
      }

      if (zonasRaw is Map && zonasRaw['ok'] == false) {
        throw Exception(zonasRaw['error'] ?? 'Error API');
      }
      if (tareasRaw is Map && tareasRaw['ok'] == false) {
        throw Exception(tareasRaw['error'] ?? 'Error API');
      }

      zonas = isManager ? _asList(zonasRaw, const ['data', 'zonas']) : [];
      tareas = _asList(tareasRaw, const ['data', 'tareas', 'tasks']);

      setState(() {});
    } catch (e) {
      setState(() => error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  // ===========================
  // CLOUDINARY (UNSIGNED) - web safe (bytes)
  // ===========================
  Future<String> uploadEvidenceToCloudinary(XFile xfile) async {
    const cloudName = "dxqes4e20";
    const uploadPreset = "reports_unsigned";

    final uri =
        Uri.parse("https://api.cloudinary.com/v1_1/$cloudName/image/upload");

    final bytes = await xfile.readAsBytes();
    final filename = xfile.name.isNotEmpty ? xfile.name : "evidence.jpg";

    final req = http.MultipartRequest("POST", uri)
      ..fields["upload_preset"] = uploadPreset
      ..files.add(
        http.MultipartFile.fromBytes(
          "file",
          bytes,
          filename: filename,
        ),
      );

    final res = await req.send();
    final body = await res.stream.bytesToString();

    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw Exception("Cloudinary upload failed (${res.statusCode}): $body");
    }

    final data = jsonDecode(body) as Map<String, dynamic>;
    final url = (data["secure_url"] ?? "").toString();
    if (url.isEmpty) throw Exception("Cloudinary no devolvió secure_url");

    return url;
  }

  Future<void> _postEvidenceJson({
    required String taskId,
    required String comment,
    required String imageUrl,
  }) async {
    await api.post("/api/tareas/$taskId/evidence", {
      "comment": comment,
      "imageUrl": imageUrl,
    });
  }

  // ===========================
  // EMPLEADO: start/finish
  // ===========================
  Future<void> _startTaskEmpleado(Map<String, dynamic> t) async {
    final id = _idOf(t);
    if (id.isEmpty) return;

    try {
      await api.post('/api/tareas/$id/start', {});
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Tarea iniciada')),
        );
      }
      await _loadAll();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e')),
        );
      }
    }
  }

  Future<void> _finishTaskEmpleado(Map<String, dynamic> t) async {
    final id = _idOf(t);
    if (id.isEmpty) return;

    try {
      await api.post('/api/tareas/$id/finish', {});
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Tarea finalizada')),
        );
      }
      await _loadAll();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e')),
        );
      }
    }
  }

  // ===========================
  // EMPLEADO: evidencia
  // ===========================
  Future<void> _evidenceEmpleado(Map<String, dynamic> t) async {
    final id = _idOf(t);
    if (id.isEmpty) return;

    final payload = await showDialog<_EvidencePayload>(
      context: context,
      barrierDismissible: false,
      builder: (_) => _EvidenceDialog(picker: picker),
    );

    if (payload == null) return;

    final comment = payload.comment.trim();
    if (comment.isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Escribe un comentario')),
        );
      }
      return;
    }

    if (payload.photo == null) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Selecciona una foto')),
        );
      }
      return;
    }

    bool loaderOpen = false;

    if (mounted) {
      loaderOpen = true;
      showDialog(
        context: context,
        barrierDismissible: false,
        useRootNavigator: true,
        builder: (_) => const AlertDialog(
          content: SizedBox(
            height: 70,
            child: Row(
              children: [
                CircularProgressIndicator(),
                SizedBox(width: 16),
                Expanded(child: Text("Subiendo evidencia...")),
              ],
            ),
          ),
        ),
      );
    }

    try {
      final imageUrl = await uploadEvidenceToCloudinary(payload.photo!);

      await _postEvidenceJson(
        taskId: id,
        comment: comment,
        imageUrl: imageUrl,
      );

      if (loaderOpen && mounted) {
        Navigator.of(context, rootNavigator: true).pop();
        loaderOpen = false;
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Evidencia subida ✅')),
        );
      }

      await _loadAll();
    } catch (e) {
      if (loaderOpen && mounted) {
        Navigator.of(context, rootNavigator: true).pop();
        loaderOpen = false;
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e')),
        );
      }
    }
  }

  // ===========================
  // MANAGER: cambiar estado / eliminar
  // ===========================
  Future<void> _changeStatusManager(
      Map<String, dynamic> t, String status) async {
    if (!isManager) return;

    final id = _idOf(t);
    if (id.isEmpty) return;

    try {
      await api.patch('/api/tareas/$id', {'estado': status});
      await _loadAll();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e')),
        );
      }
    }
  }

  Future<void> _deleteTaskManager(Map<String, dynamic> t) async {
    if (!isManager) return;

    final id = _idOf(t);
    if (id.isEmpty) return;

    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Eliminar tarea'),
        content: Text('¿Eliminar "${_titleOf(t)}"?'),
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
      await api.delete('/api/tareas/$id');
      await _loadAll();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e')),
        );
      }
    }
  }

  Future<void> _newTaskManager() async {
    if (!isManager) return;

    // necesitas zonas para el dropdown
    if (zonas.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No hay zonas cargadas')),
      );
      return;
    }

    final payload = await showDialog<_NewTaskPayload>(
      context: context,
      barrierDismissible: false,
      builder: (_) => _NewTaskDialog(zonas: zonas),
    );

    if (payload == null) return;

    try {
      // ✅ AJUSTA keys si tu API usa otros nombres
      await api.post('/api/tareas', {
        "titulo": payload.titulo,
        "descripcion": payload.descripcion,
        "zonaId": payload.zonaId,
        "estado": payload.estado, // opcional
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Tarea creada ✅')),
        );
      }

      await _loadAll();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e')),
        );
      }
    }
  }

  // ===========================
  // UI
  // ===========================
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
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      isManager ? 'Tareas' : 'Mis tareas',
                      style: const TextStyle(
                          fontSize: 22, fontWeight: FontWeight.w900),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Asignación y control (API + Firestore)',
                      style: TextStyle(color: AppTheme.muted),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),

              // ✅ SOLO ADMIN/SUPERVISOR: crear tarea
              if (isManager) ...[
                IconPillButton(
                  icon: Icons.add,
                  onTap: _newTaskManager,
                ),
                const SizedBox(width: 10),
              ],

              IconPillButton(
                icon: Icons.refresh,
                onTap: _loadAll,
              ),
            ],
          ),
          const SizedBox(height: 14),
          TextField(
            decoration: const InputDecoration(
              hintText: 'Buscar tarea...',
              prefixIcon: Icon(Icons.search),
            ),
            onChanged: (v) => setState(() => query = v),
          ),
          if (loading) ...[
            const SizedBox(height: 12),
            const LinearProgressIndicator(),
          ],
          if (debugInfo != null) ...[
            const SizedBox(height: 10),
            Text(
              debugInfo!,
              style: const TextStyle(fontSize: 12, color: AppTheme.muted),
            ),
          ],
          if (error != null) ...[
            const SizedBox(height: 10),
            Text(error!, style: const TextStyle(color: AppTheme.danger)),
          ],
          const SizedBox(height: 12),
          Expanded(
            child: list.isEmpty
                ? const Center(child: Text('Sin tareas'))
                : ListView.separated(
                    itemCount: list.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (context, i) {
                      final t = Map<String, dynamic>.from(list[i] as Map);
                      final title = _titleOf(t);
                      final st = _statusOf(t);
                      final zn = _zonaNameOf(t);

                      final stLower = st.toLowerCase().trim();

                      final enableStart =
                          !isManager && (stLower == 'pendiente');
                      final enableFinish = !isManager &&
                          (stLower == 'en proceso' ||
                              stLower == 'en_proceso' ||
                              stLower == 'enproceso');

                      return AppCard(
                        padding: const EdgeInsets.all(16),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Padding(
                              padding: EdgeInsets.only(top: 2),
                              child: Icon(Icons.check_circle_outline,
                                  color: AppTheme.muted),
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    title,
                                    style: const TextStyle(
                                      fontSize: 18,
                                      fontWeight: FontWeight.w900,
                                      color: AppTheme.text,
                                    ),
                                  ),
                                  const SizedBox(height: 10),
                                  if (zn.trim().isNotEmpty) Pill('Zona: $zn'),
                                ],
                              ),
                            ),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                StatusBadge(st),
                                const SizedBox(height: 12),
                                Row(
                                  children: [
                                    if (!isManager) ...[
                                      IconPillButton(
                                        icon: Icons.play_arrow,
                                        onTap: enableStart
                                            ? () => _startTaskEmpleado(t)
                                            : null,
                                      ),
                                      const SizedBox(width: 10),
                                      IconPillButton(
                                        icon: Icons.photo_camera,
                                        onTap: () => _evidenceEmpleado(t),
                                      ),
                                      const SizedBox(width: 10),
                                      IconPillButton(
                                        icon: Icons.flag,
                                        onTap: enableFinish
                                            ? () => _finishTaskEmpleado(t)
                                            : null,
                                      ),
                                    ] else ...[
                                      IconPillButton(
                                        icon: Icons.tune,
                                        onTap: () async {
                                          final picked = await showMenu<String>(
                                            context: context,
                                            position:
                                                const RelativeRect.fromLTRB(
                                                    999, 120, 16, 0),
                                            items: const [
                                              PopupMenuItem(
                                                  value: 'Pendiente',
                                                  child: Text('Pendiente')),
                                              PopupMenuItem(
                                                  value: 'En proceso',
                                                  child: Text('En proceso')),
                                              PopupMenuItem(
                                                  value: 'Completada',
                                                  child: Text('Completada')),
                                            ],
                                          );
                                          if (picked != null) {
                                            _changeStatusManager(t, picked);
                                          }
                                        },
                                      ),
                                      const SizedBox(width: 10),
                                      IconPillButton(
                                        icon: Icons.delete_outline,
                                        onTap: () => _deleteTaskManager(t),
                                      ),
                                    ],
                                  ],
                                ),
                              ],
                            ),
                          ],
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}

/* ============================================================
   DIALOG EVIDENCIA
============================================================ */

class _EvidencePayload {
  final XFile? photo;
  final String comment;
  _EvidencePayload({required this.photo, required this.comment});
}

class _EvidenceDialog extends StatefulWidget {
  final ImagePicker picker;
  const _EvidenceDialog({required this.picker});

  @override
  State<_EvidenceDialog> createState() => _EvidenceDialogState();
}

class _EvidenceDialogState extends State<_EvidenceDialog> {
  XFile? photo;
  final commentCtrl = TextEditingController();
  bool picking = false;

  @override
  void dispose() {
    commentCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickPhoto() async {
    setState(() => picking = true);
    try {
      final picked = await widget.picker.pickImage(
        source: ImageSource.gallery,
        imageQuality: 82,
        maxWidth: 1600,
      );
      if (picked != null) setState(() => photo = picked);
    } finally {
      if (mounted) setState(() => picking = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Agregar evidencia'),
      content: SizedBox(
        width: 460,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: picking ? null : _pickPhoto,
                    icon: const Icon(Icons.photo_library),
                    label: Text(
                        photo == null ? 'Seleccionar foto' : 'Cambiar foto'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            if (photo != null)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  border: Border.all(color: AppTheme.border),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.check_circle, size: 18),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        photo!.name.isNotEmpty
                            ? photo!.name
                            : 'Foto seleccionada',
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    IconButton(
                      tooltip: 'Quitar',
                      onPressed: () => setState(() => photo = null),
                      icon: const Icon(Icons.close),
                    ),
                  ],
                ),
              ),
            const SizedBox(height: 12),
            TextField(
              controller: commentCtrl,
              maxLines: 4,
              decoration: const InputDecoration(
                labelText: 'Comentario',
                hintText: 'Describe la evidencia...',
              ),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context, null),
          child: const Text('Cancelar'),
        ),
        ElevatedButton.icon(
          onPressed: () {
            Navigator.pop(
              context,
              _EvidencePayload(photo: photo, comment: commentCtrl.text),
            );
          },
          icon: const Icon(Icons.cloud_upload),
          label: const Text('Subir'),
        ),
      ],
    );
  }
}

/* ============================================================
   DIALOG NUEVA TAREA (solo admin/supervisor)
============================================================ */

class _NewTaskPayload {
  final String titulo;
  final String zonaId;
  final String descripcion;
  final String estado;

  _NewTaskPayload({
    required this.titulo,
    required this.zonaId,
    required this.descripcion,
    required this.estado,
  });
}

class _NewTaskDialog extends StatefulWidget {
  final List<dynamic> zonas;
  const _NewTaskDialog({required this.zonas});

  @override
  State<_NewTaskDialog> createState() => _NewTaskDialogState();
}

class _NewTaskDialogState extends State<_NewTaskDialog> {
  final tituloCtrl = TextEditingController();
  final descCtrl = TextEditingController();

  String? zonaId;
  String estado = 'Pendiente';

  String _zonaIdOf(dynamic z) {
    final m = Map<String, dynamic>.from(z as Map);
    final v = m['id'] ?? m['_id'] ?? m['docId'];
    return (v ?? '').toString();
  }

  String _zonaNameOf(dynamic z) {
    final m = Map<String, dynamic>.from(z as Map);
    return (m['nombre'] ?? m['name'] ?? m['zona'] ?? 'Zona').toString();
  }

  @override
  void initState() {
    super.initState();
    if (widget.zonas.isNotEmpty) {
      zonaId = _zonaIdOf(widget.zonas.first);
    }
  }

  @override
  void dispose() {
    tituloCtrl.dispose();
    descCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Nueva tarea'),
      content: SizedBox(
        width: 520,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: tituloCtrl,
                decoration: const InputDecoration(
                  labelText: 'Título',
                  hintText: 'Ej. Limpiar recepción',
                ),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                value: zonaId,
                decoration: const InputDecoration(labelText: 'Zona'),
                items: widget.zonas.map((z) {
                  final id = _zonaIdOf(z);
                  return DropdownMenuItem(
                    value: id,
                    child: Text(_zonaNameOf(z)),
                  );
                }).toList(),
                onChanged: (v) => setState(() => zonaId = v),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                value: estado,
                decoration: const InputDecoration(labelText: 'Estado inicial'),
                items: const [
                  DropdownMenuItem(
                      value: 'Pendiente', child: Text('Pendiente')),
                  DropdownMenuItem(
                      value: 'En proceso', child: Text('En proceso')),
                  DropdownMenuItem(
                      value: 'Completada', child: Text('Completada')),
                ],
                onChanged: (v) => setState(() => estado = v ?? 'Pendiente'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: descCtrl,
                maxLines: 3,
                decoration: const InputDecoration(
                  labelText: 'Descripción (opcional)',
                  hintText: 'Detalles de la tarea...',
                ),
              ),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context, null),
          child: const Text('Cancelar'),
        ),
        ElevatedButton.icon(
          onPressed: () {
            final titulo = tituloCtrl.text.trim();
            final zId = (zonaId ?? '').trim();

            if (titulo.isEmpty || zId.isEmpty) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Título y zona son obligatorios')),
              );
              return;
            }

            Navigator.pop(
              context,
              _NewTaskPayload(
                titulo: titulo,
                zonaId: zId,
                descripcion: descCtrl.text.trim(),
                estado: estado,
              ),
            );
          },
          icon: const Icon(Icons.save),
          label: const Text('Crear'),
        ),
      ],
    );
  }
}
