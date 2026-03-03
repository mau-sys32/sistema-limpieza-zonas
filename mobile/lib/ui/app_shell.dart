import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:firebase_auth/firebase_auth.dart';

import '../services/session.dart';

class AppShell extends StatelessWidget {
  final Widget child;
  const AppShell({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    final location = GoRouterState.of(context).uri.toString();
    final isManager = Session.isBoss;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Sistema de Limpieza por Zonas'),
        actions: [
          IconButton(
            tooltip: 'Cerrar sesión',
            icon: const Icon(Icons.logout),
            onPressed: () async {
              await FirebaseAuth.instance.signOut();
              Session.clear();
              if (context.mounted) context.go('/login');
            },
          ),
        ],
      ),
      drawer: Drawer(
        child: SafeArea(
          child: Container(
            color: const Color(0xFF0B1220), // fondo oscuro (bg)
            child: Column(
              children: [
                _DrawerHeader(isManager: isManager),
                const Divider(height: 1, color: Color(0xFF25314A)),

                // ✅ SOLO MANAGER
                if (isManager)
                  _Item(
                    title: 'Dashboard',
                    icon: Icons.dashboard,
                    active: location.startsWith('/dashboard'),
                    onTap: () => context.go('/dashboard'),
                  ),

                // ✅ TODOS
                _Item(
                  title: 'Zonas',
                  icon: Icons.map,
                  active: location.startsWith('/zonas'),
                  onTap: () => context.go('/zonas'),
                ),
                _Item(
                  title: 'Tareas',
                  icon: Icons.checklist,
                  active: location.startsWith('/tareas'),
                  onTap: () => context.go('/tareas'),
                ),

                if (isManager) ...[
                  _Item(
                    title: 'Personal',
                    icon: Icons.people,
                    active: location.startsWith('/personal'),
                    onTap: () => context.go('/personal'),
                  ),
                  _Item(
                    title: 'Historial',
                    icon: Icons.history,
                    active: location.startsWith('/historial'),
                    onTap: () => context.go('/historial'),
                  ),
                  _Item(
                    title: 'Reportes',
                    icon: Icons.report_outlined,
                    active: location.startsWith('/reportes'),
                    onTap: () => context.go('/reportes'),
                  ),
                ],

                const Spacer(),

                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: const BoxDecoration(
                    border: Border(top: BorderSide(color: Color(0xFF25314A))),
                    color: Color(0xFF0F172A),
                  ),
                  child: const Text(
                    'Flutter (Web → Móvil)',
                    style: TextStyle(fontSize: 12, color: Color(0xFF9AA4B2)),
                    textAlign: TextAlign.center,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
      body: child,
    );
  }
}

class _DrawerHeader extends StatelessWidget {
  final bool isManager;
  const _DrawerHeader({required this.isManager});

  @override
  Widget build(BuildContext context) {
    final nombre = (Session.nombre ?? '').trim();
    final rol = (Session.role ?? 'empleado').toLowerCase();

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: const BoxDecoration(
        color: Color(0xFF0F172A), // panel
        border: Border(bottom: BorderSide(color: Color(0xFF25314A))),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 18,
            backgroundColor: const Color(0xFF111C33),
            child: Icon(
              isManager ? Icons.admin_panel_settings : Icons.badge,
              color: const Color(0xFF3B82F6),
              size: 20,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  nombre.isEmpty ? 'Usuario' : nombre,
                  style: const TextStyle(fontWeight: FontWeight.w900),
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  rol,
                  style:
                      const TextStyle(color: Color(0xFF9AA4B2), fontSize: 12),
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Item extends StatelessWidget {
  final String title;
  final IconData icon;
  final bool active;
  final VoidCallback onTap;

  const _Item({
    required this.title,
    required this.icon,
    required this.active,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    // tokens tipo web
    const border = Color(0xFF25314A);
    const panel2 = Color(0xFF111C33);
    const primary = Color(0xFF3B82F6);
    const muted = Color(0xFF9AA4B2);

    return Container(
      margin: const EdgeInsets.fromLTRB(10, 8, 10, 0),
      decoration: BoxDecoration(
        color: active ? panel2 : Colors.transparent,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: active ? primary.withOpacity(.65) : border),
      ),
      child: ListTile(
        leading: Icon(icon, color: active ? primary : muted),
        title: Text(
          title,
          style: TextStyle(
            fontWeight: active ? FontWeight.w800 : FontWeight.w600,
            color: Colors.white,
          ),
        ),
        trailing:
            active ? const Icon(Icons.chevron_right, color: primary) : null,
        selected: active,
        onTap: () {
          Navigator.of(context).pop(); // cierra drawer
          onTap();
        },
      ),
    );
  }
}
