import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

class Session {
  static String? uid;
  static String? role;
  static String? nombre;

  static bool get isBoss {
    final r = (role ?? '').toLowerCase();
    return r == 'admin' || r == 'supervisor';
  }

  static void clear() {
    uid = null;
    role = null;
    nombre = null;
  }

  //  Se llama al iniciar/refresh para reconstruir sesión
  static Future<void> bootstrap() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      clear();
      return;
    }

    uid = user.uid;

    final snap = await FirebaseFirestore.instance
        .collection('users')
        .doc(user.uid)
        .get();
    if (!snap.exists) {
      role = 'empleado';
      nombre = user.email ?? '';
      return;
    }

    final data = snap.data()!;
    role = (data['rol'] ?? 'empleado').toString();
    nombre = (data['nombre'] ?? '').toString();
  }
}
