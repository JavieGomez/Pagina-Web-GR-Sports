# GR Sports

Web informativa y portal de usuarios de GR Sports.

## Ejecutar en local

Sirve los archivos por HTTP para permitir los módulos JavaScript del navegador:

```powershell
python -m http.server 8765
```

Abre `http://127.0.0.1:8765/`.

## Configurar Supabase

1. En `config.js`, configura `supabaseUrl` y `supabasePublishableKey`. La clave `sb_publishable_...` (o la clave antigua `anon`) está diseñada para su uso en el navegador. **No añadas claves `secret` ni `service_role` a este repositorio.**
2. En el proyecto, abre **SQL Editor** y ejecuta el contenido de `supabase/setup.sql`. Las tablas tienen Row Level Security y permisos explícitos porque Supabase ya no expone las nuevas tablas por defecto en todos los proyectos.
3. En **Authentication → URL Configuration**, permite el origen local de desarrollo y el dominio donde se publique la web como URLs de retorno. Para recuperación, incluye `https://javiegomez.github.io/Pagina-Web-GR-Sports/restablecer.html?recovery=1`.
4. Registra la cuenta que administrará GR Sports. En **Authentication → Users**, edita su `app_metadata` y añade `role: admin`. Los registros públicos no pueden asignarse permisos de equipo.
5. Si se quiere recibir mensajes en tiempo real, activa Realtime para `service_requests`, `sessions` y `chat_messages` si la publicación `supabase_realtime` no estaba disponible al ejecutar el SQL.

El perfil creado por registro empieza como usuario normal. Solo un administrador o entrenador configurado en `app_metadata` puede acceder a funciones internas. Las estimaciones son orientativas y sus importes están en `config.js`. El número de WhatsApp queda vacío hasta que GR Sports elija un número destinado a contacto público; los botones no envían mensajes automáticamente.

## Páginas

- `index.html`: presentación, servicios y noticias.
- `equipo.html`: perfiles de Miguel Guinea Montes y Javier Gómez Martínez.
- `solicitud.html`: formulario dinámico para cada servicio, cálculo orientativo, autenticación y envío de la solicitud.
- `acceso.html`: registro e inicio de sesión.
- `restablecer.html`: solicitud y confirmación segura de cambio de contraseña mediante enlace de recuperación.
- `cuenta.html`: solicitudes, estados e historial de clases/entrenamientos.
- `administracion.html`: solicitudes pendientes y calendario mensual.
- `sesion.html`: indicaciones del entrenador y chat de grupo de la sesión.
