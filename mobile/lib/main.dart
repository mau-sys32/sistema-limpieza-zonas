import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:go_router/go_router.dart';

import 'firebase_options.dart';

import 'ui/app_shell.dart';
import 'ui/app_theme.dart';

import 'pages/login_page.dart';
import 'pages/dashboard_page.dart';

import 'pages/zonas_page.dart' as zonas_page;
import 'pages/tareas_page.dart' as tareas_page;

import 'pages/personal_page.dart';
import 'pages/historial_page.dart';
import 'pages/reportes_page.dart';

import 'services/session.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );

  // ✅ WEB: mantener sesión al refrescar
  await FirebaseAuth.instance.setPersistence(Persistence.LOCAL);

  // ✅ Reconstruir sesión si ya había usuario logueado
  await Session.bootstrap();

  runApp(const App());
}

class App extends StatelessWidget {
  const App({super.key});

  @override
  Widget build(BuildContext context) {
    final user = FirebaseAuth.instance.currentUser;

    final router = GoRouter(
      debugLogDiagnostics: true,
      initialLocation:
          user == null ? '/login' : (Session.isBoss ? '/dashboard' : '/tareas'),
      redirect: (context, state) {
        final user = FirebaseAuth.instance.currentUser;
        final loggedIn = user != null;
        final loc = state.matchedLocation;
        final goingLogin = loc == '/login';

        if (!loggedIn && !goingLogin) return '/login';

        if (loggedIn && goingLogin) {
          if (Session.role == null || Session.role!.isEmpty) return '/tareas';
          return Session.isBoss ? '/dashboard' : '/tareas';
        }

        if (loggedIn && !Session.isBoss) {
          const blockedRoutes = [
            '/dashboard',
            '/personal',
            '/historial',
            '/reportes',
          ];
          if (blockedRoutes.any((r) => loc.startsWith(r))) return '/tareas';
        }

        return null;
      },
      routes: [
        GoRoute(
          path: '/login',
          builder: (context, state) => const LoginPage(),
        ),
        ShellRoute(
          builder: (context, state, child) => AppShell(child: child),
          routes: [
            GoRoute(
              path: '/dashboard',
              builder: (context, state) => const DashboardPage(),
            ),
            GoRoute(
              path: '/zonas',
              builder: (context, state) => const zonas_page.ZonasPage(),
            ),
            GoRoute(
              path: '/tareas',
              builder: (context, state) => const tareas_page.TareasPage(),
            ),
            GoRoute(
              path: '/personal',
              builder: (context, state) => const PersonalPage(),
            ),
            GoRoute(
              path: '/historial',
              builder: (context, state) => const HistorialPage(),
            ),
            GoRoute(
              path: '/reportes',
              builder: (context, state) => const ReportesPage(),
            ),
          ],
        ),
      ],
    );

    return MaterialApp.router(
      debugShowCheckedModeBanner: false,
      title: 'Sistema de Limpieza',
      theme: AppTheme.theme(),
      routerConfig: router,
    );
  }
}
