import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:firebase_auth/firebase_auth.dart';
import 'package:image_picker/image_picker.dart';

import '../core/env.dart';

class ApiClient {
  final FirebaseAuth _auth = FirebaseAuth.instance;

  /* ============================================================
     HEADERS JSON
  ============================================================ */
  Future<Map<String, String>> _headers() async {
    final user = _auth.currentUser;
    final token = user != null ? await user.getIdToken(true) : null;

    return {
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  /* ============================================================
     MÉTODOS REST
  ============================================================ */

  Future<dynamic> get(String path) => request(path, method: 'GET');

  Future<dynamic> post(String path, Map<String, dynamic> body) =>
      request(path, method: 'POST', body: body);

  Future<dynamic> put(String path, Map<String, dynamic> body) =>
      request(path, method: 'PUT', body: body);

  Future<dynamic> patch(String path, Map<String, dynamic> body) =>
      request(path, method: 'PATCH', body: body);

  Future<dynamic> delete(String path) => request(path, method: 'DELETE');

  Future<dynamic> request(
    String path, {
    String method = 'GET',
    Map<String, dynamic>? body,
  }) async {
    final uri = Uri.parse('${Env.apiBaseUrl}$path');
    final headers = await _headers();
    final m = method.toUpperCase();

    late http.Response res;

    if (m == 'POST') {
      res =
          await http.post(uri, headers: headers, body: jsonEncode(body ?? {}));
    } else if (m == 'PUT') {
      res = await http.put(uri, headers: headers, body: jsonEncode(body ?? {}));
    } else if (m == 'PATCH') {
      res =
          await http.patch(uri, headers: headers, body: jsonEncode(body ?? {}));
    } else if (m == 'DELETE') {
      res = await http.delete(uri, headers: headers);
    } else {
      res = await http.get(uri, headers: headers);
    }

    final text = res.body;

    dynamic data;
    try {
      data = text.isNotEmpty ? jsonDecode(text) : null;
    } catch (_) {
      data = text.isNotEmpty ? text : null;
    }

    if (res.statusCode < 200 || res.statusCode >= 300) {
      final msg = (data is Map && data['error'] != null)
          ? data['error'].toString()
          : (data is Map && data['message'] != null)
              ? data['message'].toString()
              : 'HTTP ${res.statusCode}';
      throw Exception(msg);
    }

    return data;
  }

  /* ============================================================
     MULTIPART (FOTO + CAMPOS)
     Compatible con:
     - Android
     - iOS
     - Web
  ============================================================ */

  Future<dynamic> multipartXFile(
    String path, {
    required Map<String, String> fields,
    required String fileField,
    required XFile file,
    String method = 'POST',
  }) async {
    final uri = Uri.parse('${Env.apiBaseUrl}$path');

    final user = _auth.currentUser;
    final token = user != null ? await user.getIdToken(true) : null;

    if (token == null) {
      throw Exception('No token');
    }

    final request = http.MultipartRequest(
      method.toUpperCase(),
      uri,
    );

    request.headers['Authorization'] = 'Bearer $token';

    // Campos
    request.fields.addAll(fields);

    // 🔥 Web vs Mobile
    if (kIsWeb) {
      final bytes = await file.readAsBytes();

      request.files.add(
        http.MultipartFile.fromBytes(
          fileField,
          bytes,
          filename: file.name.isNotEmpty ? file.name : 'evidence.jpg',
        ),
      );
    } else {
      request.files.add(
        await http.MultipartFile.fromPath(
          fileField,
          file.path,
        ),
      );
    }

    final streamed = await request.send();
    final response = await http.Response.fromStream(streamed);

    final text = response.body;

    dynamic data;
    try {
      data = text.isNotEmpty ? jsonDecode(text) : null;
    } catch (_) {
      data = text.isNotEmpty ? text : null;
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      final msg = (data is Map && data['error'] != null)
          ? data['error'].toString()
          : (data is Map && data['message'] != null)
              ? data['message'].toString()
              : 'HTTP ${response.statusCode}';
      throw Exception(msg);
    }

    return data;
  }
}
