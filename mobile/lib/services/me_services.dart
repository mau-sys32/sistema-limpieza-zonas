import '../services/api_client.dart';
import '../services/session.dart';

class MeService {
  MeService(this.api);
  final ApiClient api;

  Future<void> loadMe() async {
    final me = await api.get('/api/me');
    Session.uid = (me['uid'] ?? '').toString();
    Session.role = (me['role'] ?? me['rol'] ?? 'empleado').toString();
  }
}
