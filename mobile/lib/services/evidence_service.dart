import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:firebase_auth/firebase_auth.dart';
import '../core/env.dart';

class EvidenceService {
  Future<dynamic> uploadEvidence({
    required String taskId,
    required File photo,
    required String comment,
  }) async {
    final user = FirebaseAuth.instance.currentUser;
    final token = user != null ? await user.getIdToken(true) : null;

    final uri = Uri.parse('${Env.apiBaseUrl}/tasks/$taskId/evidence');

    final req = http.MultipartRequest('POST', uri);
    if (token != null) req.headers['Authorization'] = 'Bearer $token';

    req.fields['comment'] = comment;
    req.files.add(await http.MultipartFile.fromPath('photo', photo.path));

    final streamed = await req.send();
    final res = await http.Response.fromStream(streamed);

    dynamic data;
    try {
      data = res.body.isNotEmpty ? jsonDecode(res.body) : null;
    } catch (_) {
      data = res.body;
    }

    if (res.statusCode < 200 || res.statusCode >= 300) {
      final msg = (data is Map && data['error'] != null)
          ? data['error'].toString()
          : 'HTTP ${res.statusCode}';
      throw Exception(msg);
    }

    return data;
  }
}
