<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>@yield('title', 'SafeMap')</title>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
  <meta name="csrf-token" content="{{ csrf_token() }}">
  @yield('fonts')
  @yield('styles')
</head>
<body>
  @yield('content')
  @yield('scripts')
</body>
</html>
