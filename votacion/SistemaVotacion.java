SistemaVotacion.java

import java.util.HashSet;
import java.util.Set;

public class SistemaVotacion {

    private static final Set<String> votantes = new HashSet<>();

    private static int candidato1 = 0;
    private static int candidato2 = 0;
    private static int candidato3 = 0;
    private static int candidato4 = 0;
    private static int candidato5 = 0;
    private static int candidato6 = 0;
    private static int blanco = 0;

    public static boolean validarCiudadano(String cedula, String nombre, boolean biometria) {
        return cedula != null &&
               cedula.matches("\\d{6,15}") &&
               nombre != null &&
               nombre.length() >= 3 &&
               biometria;
    }

    public static boolean yaVoto(String cedula) {
        return votantes.contains(cedula);
    }

    public static String registrarVoto(String cedula, String candidato) {

        if (yaVoto(cedula)) {
            return "El ciudadano ya votó.";
        }

        votantes.add(cedula);

        switch (candidato) {
            case "Candidato 1":
                candidato1++;
                break;
            case "Candidato 2":
                candidato2++;
                break;
            case "Candidato 3":
                candidato3++;
                break;
            case "Candidato 4":
                candidato4++;
                break;
            case "Candidato 5":
                candidato5++;
                break;
            case "Candidato 6":
                candidato6++;
                break;
            default:
                blanco++;
        }

        return "Voto registrado correctamente";
    }

    public static void mostrarResultados() {
        System.out.println("===== RESULTADOS =====");
        System.out.println("Candidato 1: " + candidato1);
        System.out.println("Candidato 2: " + candidato2);
        System.out.println("Candidato 3: " + candidato3);
        System.out.println("Candidato 4: " + candidato4);
        System.out.println("Candidato 5: " + candidato5);
        System.out.println("Candidato 6: " + candidato6);
        System.out.println("Blanco: " + blanco);
    }

    public static void main(String[] args) {

        String cedula = "12345678";
        String nombre = "Nicolas";
        boolean biometria = true;

        if (validarCiudadano(cedula, nombre, biometria)) {
            System.out.println(registrarVoto(cedula, "Candidato 1"));
            System.out.println(registrarVoto(cedula, "Candidato 2")); // intento doble
        } else {
            System.out.println("Ciudadano no válido");
        }

        mostrarResultados();
    }
}