import 'package:flutter/material.dart';

class AppTheme {
  static const bg = Color(0xFF0B1220);
  static const panel = Color(0xFF0F172A);
  static const panel2 = Color(0xFF111C33);
  static const border = Color(0xFF25314A);

  static const primary = Color(0xFF3B82F6);
  static const success = Color(0xFF22C55E);
  static const warning = Color(0xFFF59E0B);
  static const danger = Color(0xFFEF4444);

  static const text = Color(0xFFE6EAF2);
  static const muted = Color(0xFF9AA4B2);

  static ThemeData theme() {
    final base = ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      colorSchemeSeed: primary,
    );

    return base.copyWith(
      scaffoldBackgroundColor: bg,
      appBarTheme: const AppBarTheme(
        backgroundColor: panel,
        foregroundColor: text,
        elevation: 0,
      ),
      cardTheme: const CardThemeData(
        color: panel,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.all(Radius.circular(18)),
          side: BorderSide(color: border),
        ),
      ),
      dividerTheme:
          const DividerThemeData(color: border, thickness: 1, space: 1),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: panel2,
        hintStyle: const TextStyle(color: muted),
        labelStyle: const TextStyle(color: muted),
        prefixIconColor: muted,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: primary, width: 1.2),
        ),
      ),
      snackBarTheme: const SnackBarThemeData(
        backgroundColor: panel,
        contentTextStyle: TextStyle(color: text),
      ),
      listTileTheme: const ListTileThemeData(
        iconColor: muted,
        textColor: text,
      ),
    );
  }
}
