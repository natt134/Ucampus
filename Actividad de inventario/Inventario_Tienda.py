# Diccionario Estructura: "producto": [precio, stock]
productos = {
    "arroz": [3500, 20],
    "leche": [4500, 15],
    "pan": [2500, 30],
    "papa": [1500, 50],
    "huevos": [500, 300],
    "aguacate": [3500, 20],
    "chocolate": [2500, 30],
    }

# BUCLE PRINCIPAL
while True:
    print("\n==============================")
    print("=== PRODUCTOS DISPONIBLES ===")
    for prod, datos in productos.items():
        print(f"- {prod.capitalize()}: ${datos[0]} | Stock: {datos[1]}")

    print("\nOPCIONES:")
    print("1. Vender un producto")
    print("2. Cambiar precio")
    print("3. Cambiar stock")
    print("4. Ver combos disponibles")
    print("5. Comprar un combo")
    print("6. Salir")

    opcion = input("\nElige una opción (1-6): ").strip()

    if opcion == "1":
        prod = input("¿Qué producto deseas vender?: ").lower().strip()
        if prod in productos:
            cant = int(input("¿Cuántas unidades?: "))
            if cant <= productos[prod][1]:
                total = int((productos[prod][0] * cant) * 0.90)
                productos[prod][1] -= cant  # Descontamos stock
                print(f"-> Total a pagar (con 10% desc): ${total}")
                print(f"-> Stock restante de {prod}: {productos[prod][1]}")
            else:
                print("-> No hay suficiente stock.")
        else:
            print("-> El producto no existe.")

    elif opcion == "2":
        prod = input("¿Qué producto modificar?: ").lower().strip()
        if prod in productos:
            productos[prod][0] = int(input("Nuevo precio: "))
            print(f"-> Nuevo precio de {prod}: ${productos[prod][0]}")
        else:
            print("-> El producto no existe.")

    elif opcion == "3":
        prod = input("¿A qué producto cambiar stock?: ").lower().strip()
        if prod in productos:
            productos[prod][1] = int(input("Nuevo stock: "))
            print(f"-> Nuevo stock de {prod}: {productos[prod][1]}")
        else:
            print("-> El producto no existe.")

    elif opcion == "4":
        print("\n--- COMBOS (CON 10% DESC) ---")
        desayuno = int((productos["leche"][0] + productos["pan"][0]) * 0.90)
        almuerzo = int((productos["arroz"][0] + productos["papa"][0]) * 0.90)
        cena= int((productos["huevos"][0]+ productos["aguacate"][0]+ productos["chocolate"][0]) * 0.90)
        print(f"- Desayuno (Leche + Pan): ${desayuno}")
        print(f"- Almuerzo (Arroz + Papa): ${almuerzo}")
        print(f"-Cena (Huevos + Aguacate + Chocolate): ${cena}")

    elif opcion == "5":
        combo = input("¿Qué combo deseas comprar? (desayuno / almuerzo / cena): ").lower().strip()

        if combo == "desayuno":
            # Verificar stock de leche y pan
            if productos["leche"][1] >= 1 and productos["pan"][1] >= 1:
                total = int((productos["leche"][0] + productos["pan"][0]) * 0.90)
                productos["leche"][1] -= 1  # Resta 1 leche
                productos["pan"][1] -= 1    # Resta 1 pan
                print(f"-> ¡Compra exitosa! Total a pagar: ${total}")
            else:
                print("-> No hay stock suficiente de leche o pan para este combo.")

        elif combo == "almuerzo":
            # Verificar stock de arroz y papa
            if productos["arroz"][1] >= 1 and productos["papa"][1] >= 1:
                total = int((productos["arroz"][0] + productos["papa"][0]) * 0.90)
                productos["arroz"][1] -= 1  # Resta 1 arroz
                productos["papa"][1] -= 1   # Resta 1 papa
                print(f"-> ¡Compra exitosa! Total a pagar: ${total}")
            else:
                print("-> No hay stock suficiente de arroz o papa para este combo.")
        
        elif combo == "cena":
            #Verificar stock de huevos, aguacate y chocolate
            if productos["huevos"][1] >= 1 and productos ["aguacate"][1] >=1 and productos ["chocolate"][1] >=1 :
                total= int((productos["huevos"][0] + productos["aguacate"][0] + productos["chocolate"][0]) * 0.90)
                productos["huevos"][1] -=1
                productos["aguacate"][1] -=1
                productos["chocolate"][1] -=1
                print(f"-> ¡Compra exitosa! Total a pagar: ${total}")
            else:
                print("-> No hay stock suficiente de huevos, aguacate o chocolate para este combo.")
                
        else:
            print("-> El combo ingresado no existe.")

    elif opcion == "6":
        print("¡Gracias por usar el sistema! Hasta luego.")
        break

    else:
        print("-> Opción inválida. Intenta de nuevo.")