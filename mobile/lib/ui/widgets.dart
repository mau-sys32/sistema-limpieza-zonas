import 'package:flutter/material.dart';
import 'app_theme.dart';

class AppCard extends StatelessWidget {
  final Widget child;
  final EdgeInsets padding;
  const AppCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppTheme.panel,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppTheme.border),
        boxShadow: const [
          BoxShadow(
            blurRadius: 30,
            offset: Offset(0, 18),
            color: Colors.black26,
          ),
        ],
      ),
      child: Padding(padding: padding, child: child),
    );
  }
}

class StatusBadge extends StatelessWidget {
  final String text;
  const StatusBadge(this.text, {super.key});

  Color _bg(String s) {
    final v = s.toLowerCase().trim();
    if (v.contains('final')) return const Color(0xFF0E2A1C);
    if (v.contains('proceso')) return const Color(0xFF13233E);
    return const Color(0xFF262C3A);
  }

  Color _border(String s) {
    final v = s.toLowerCase().trim();
    if (v.contains('final')) return const Color(0xFF22C55E);
    if (v.contains('proceso')) return const Color(0xFF60A5FA);
    return const Color(0xFF94A3B8);
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: _bg(text),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: _border(text)),
      ),
      child: Text(
        text,
        style: TextStyle(
          color: _border(text),
          fontWeight: FontWeight.w700,
          fontSize: 12,
        ),
      ),
    );
  }
}

class Pill extends StatelessWidget {
  final String text;
  const Pill(this.text, {super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: AppTheme.panel2,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: AppTheme.border),
      ),
      child: Text(
        text,
        style: TextStyle(
          color: AppTheme.text,
          fontWeight: FontWeight.w600,
          fontSize: 12,
        ),
      ),
    );
  }
}

class IconPillButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback? onTap;
  const IconPillButton({super.key, required this.icon, this.onTap});

  @override
  Widget build(BuildContext context) {
    final disabled = onTap == null;

    return InkWell(
      borderRadius: BorderRadius.circular(14),
      onTap: onTap,
      child: Opacity(
        opacity: disabled ? 0.45 : 1,
        child: Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            color: AppTheme.panel2,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppTheme.border),
          ),
          child: Icon(icon, color: AppTheme.text),
        ),
      ),
    );
  }
}
