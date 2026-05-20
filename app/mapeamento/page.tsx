import MapViewDynamic from "@/src/components/MapViewDynamic";
import AuthGuard from "@/src/components/AuthGuard";

export default function MapeamentoPage() {
  return (
    <AuthGuard allowedRoles={["admin", "leadership", "user"]}>
      <MapViewDynamic />
    </AuthGuard>
  );
}
